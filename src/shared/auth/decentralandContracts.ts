import { Abi, AbiFunction, decodeFunctionData, encodeFunctionData, toFunctionSelector } from 'viem'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractData, ContractName, getContract } from 'decentraland-transactions'
import { SUPPORTED_CHAIN_IDS, getSupportedChain } from '../chains'
import { isRecord } from '../utils/isRecord'
import { ADDRESS_REGEX } from './address'
import { CALLDATA_REGEX } from './hex'
import { MetaTransactionCalldataField } from './metaTransactionTypedData'

/** A Decentraland contract deployment the auth site is willing to preview calls to. */
type KnownContract = {
  name: ContractName
  /** Lowercased. */
  address: string
  chainId: number
  abi: Abi
  /** EIP-712 domain name and version the contract hashes, from the registry. */
  domainName: string
  domainVersion: string
  /** Whether the ABI exposes `executeMetaTransaction` (the relay can only target these). */
  supportsMetaTransactions: boolean
  /** The `MetaTransaction` struct field that carries the inner call, or null when not supported. */
  calldataField: MetaTransactionCalldataField | null
}

/**
 * The answer to "is this address a Decentraland contract on this chain". Three-valued on purpose:
 * a collection lookup that fails or times out is not a "no" — reading it as one would send Polygon
 * calldata as a plain transaction on whatever chain the wallet is on.
 */
type ContractResolution = { status: 'found'; contract: KnownContract } | { status: 'not_found' } | { status: 'unavailable' }

/** A call decoded against a known contract's ABI and proven to re-encode to the same bytes. */
type DecodedCall = {
  functionName: string
  args: readonly unknown[]
  /** True for `executeMetaTransaction` and `Forwarder.forwardCall`, the only payable entry points. */
  payable: boolean
  /**
   * True when the function hands calldata it receives to another contract (see FORWARDING_FUNCTIONS): the
   * decoded arguments do not say what runs, so the call cannot be reviewed as a call to this contract.
   */
  forwardsCall: boolean
}

// The registry functions whose address arguments are never called. The ERC20 functions of MANAToken and the
// non-safe ERC721 functions of the collections and the name registrar (per the OpenZeppelin code they derive
// from) only write balances, owners and allowances: the recipient, spender or operator they are handed runs
// no code inside the transaction, so a contract wallet there (a Safe, a DAO treasury, an exchange deposit)
// changes nothing about what the preview shows. Every other function keeps the conservative reading, since
// `safeTransferFrom` calls its recipient and the marketplaces, bids and rentals call the registry they are
// given. Checked by name: no registry contract declares one of these names with another meaning.
const NON_CALLING_FUNCTIONS: ReadonlySet<string> = new Set([
  'transfer',
  'transferFrom',
  'batchTransferFrom',
  'approve',
  'setApprovalForAll',
  'increaseAllowance',
  'decreaseAllowance'
])

// The registry functions that execute calldata they are given rather than an action of their own: the
// payable entry points (`executeMetaTransaction` on every meta-transaction contract, `Forwarder.forwardCall`)
// and the non-payable ones (`CollectionManager.manageCollection` and `Committee.manageCollection` run
// `_data` on a collection through the forwarder; `DCLRegistrar.forwardToResolver` runs `bytes` on the
// resolver). The previewed kinds refuse all of them: a function name and a simulation say nothing about
// the inner selector, and access control is the contract's business, not a reason to review less.
//
// Deliberately not here: `CollectionFactory.createCollection(bytes32, bytes _data)`. Its `_data` is also
// executed, but by the proxy it deploys, whose implementation is Decentraland's collection code behind a
// DAO-controlled beacon: it is the collection's `initialize`, not a call into code the requester chose.
// The simulation and the no-visible-effects acknowledgment still gate it, and refusing it would break the
// Builder's collection deployment.
const FORWARDING_FUNCTIONS: ReadonlySet<string> = new Set([
  'executeMetaTransaction',
  'forwardCall',
  'manageCollection',
  'forwardToResolver'
])

/**
 * Asks whether an address is a wearable collection (a Decentraland collection factory deployed it).
 * May resolve to `'unavailable'` or throw when the answer could not be obtained.
 */
type CollectionLookup = (address: string) => Promise<boolean | 'unavailable'>

type ResolveContractDependencies = {
  /** The chain meta-transactions are relayed on; collections only exist there. */
  metaTransactionChainId: number
  isCollection: CollectionLookup
}

function isAbiFunction(item: Abi[number]): item is AbiFunction {
  return item.type === 'function'
}

/**
 * Which `MetaTransaction` struct the contract signs, decided the way `sendMetaTransaction` decides it:
 * an `executeMetaTransaction` with a `_functionData` input executes `functionData`, any other one
 * executes `functionSignature`. Null when the ABI cannot execute meta-transactions at all.
 */
function getMetaTransactionCalldataField(abi: Abi): MetaTransactionCalldataField | null {
  const executeMetaTransaction = abi.find(item => isAbiFunction(item) && item.name === 'executeMetaTransaction')
  if (!executeMetaTransaction || !isAbiFunction(executeMetaTransaction)) {
    return null
  }
  return executeMetaTransaction.inputs.some(input => input.name === '_functionData') ? 'functionData' : 'functionSignature'
}

/** The `salt` a Decentraland contract puts in its EIP-712 domain: the chain id as a 32-byte word. */
function getMetaTransactionSalt(chainId: number): string {
  return `0x${chainId.toString(16).padStart(64, '0')}`
}

function toKnownContract(name: ContractName, chainId: number, entry: ContractData, address = entry.address): KnownContract {
  // getContract hands out the live registry object; copy the ABI so nothing downstream can mutate it.
  const abi = [...entry.abi] as unknown as Abi
  // The registry reuses one ABI per contract across chains (the Ethereum MANAToken entry carries the Polygon
  // ABI's executeMetaTransaction), so the deployment supports meta-transactions only on a chain that relays them.
  const calldataField = getSupportedChain(chainId)?.relaysMetaTransactions ? getMetaTransactionCalldataField(abi) : null
  return {
    name,
    address: address.toLowerCase(),
    chainId,
    abi,
    domainName: entry.name,
    domainVersion: entry.version,
    supportsMetaTransactions: calldataField !== null,
    calldataField
  }
}

let staticContractIndex: Map<number, Map<string, KnownContract>> | null = null

/**
 * Every Decentraland contract with a fixed address, indexed by chain and then by lowercased address.
 * Built once from the decentraland-transactions registry, for the chains the auth-server simulator can
 * preview a call on: a Decentraland contract on any other chain cannot be previewed, so it is not
 * "known" here either. Per chain on purpose: the same address is a
 * different contract on other chains (e.g. the Polygon CollectionFactoryV3 address is the Mumbai
 * ChainlinkOracle), so the chain-agnostic `getContractName` must never be used for recognition.
 * Registry entries without an address (`ERC20`, `ERC721`, `ERC721CollectionV2`) are ABI templates
 * and are skipped.
 */
function getStaticContractIndex(): Map<number, Map<string, KnownContract>> {
  if (staticContractIndex) {
    return staticContractIndex
  }
  const index = new Map<number, Map<string, KnownContract>>()
  for (const chainId of SUPPORTED_CHAIN_IDS) {
    const byAddress = new Map<string, KnownContract>()
    for (const name of Object.values(ContractName)) {
      let entry: ContractData
      try {
        entry = getContract(name, chainId as ChainId)
      } catch {
        // Not deployed on this chain.
        continue
      }
      if (!entry?.address) {
        continue
      }
      byAddress.set(entry.address.toLowerCase(), toKnownContract(name, chainId, entry))
    }
    index.set(chainId, byAddress)
  }
  staticContractIndex = index
  return index
}

/** The Decentraland contract deployed at `address` on `chainId` per the static registry, or null. */
function getKnownDecentralandContract(address: string, chainId: number): KnownContract | null {
  return getStaticContractIndex().get(chainId)?.get(address.toLowerCase()) ?? null
}

// Decentraland's own contracts that `decentraland-transactions` does not carry: the LAND and Estate registries
// (their proxies, the addresses every order, bid, rental and trade names). Recognition only: they count as
// Decentraland's when a call hands them to a Decentraland contract and they wear the verified badge, but no
// call is ever decoded against them, since no ABI ships with them, so a transaction sent to one of them stays
// an unknown transaction rather than becoming a Decentraland call whose calldata cannot be read.
const RECOGNITION_ONLY_CONTRACTS: ReadonlyArray<{ chainId: number; address: string; name: string }> = [
  { chainId: ChainId.ETHEREUM_MAINNET, name: 'LANDRegistry', address: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d' },
  { chainId: ChainId.ETHEREUM_MAINNET, name: 'EstateRegistry', address: '0x959e104e1a4db6317fa58f8295f586e1a978c297' },
  { chainId: ChainId.ETHEREUM_SEPOLIA, name: 'LANDRegistry', address: '0x42f4ba48791e2de32f5fbf553441c2672864bb33' },
  { chainId: ChainId.ETHEREUM_SEPOLIA, name: 'EstateRegistry', address: '0x369a7fbe718c870c79f99fb423882e8dd8b20486' }
]

/**
 * Whether `address` is one of Decentraland's own contracts on `chainId`: a registry contract, or one of the
 * registries the SDK does not carry (see RECOGNITION_ONLY_CONTRACTS). Says nothing about how to decode a
 * call to it; that is getKnownDecentralandContract's job, and factory collections are a lookup apart.
 */
function isRecognizedDecentralandContract(address: string, chainId: number): boolean {
  const normalized = address.toLowerCase()
  return (
    getKnownDecentralandContract(normalized, chainId) !== null ||
    RECOGNITION_ONLY_CONTRACTS.some(contract => contract.chainId === chainId && contract.address === normalized)
  )
}

/** The `ERC721CollectionV2` template for `chainId` with `address` substituted, or null when the template is not on that chain. */
function getCollectionContract(address: string, chainId: number): KnownContract | null {
  try {
    return toKnownContract(
      ContractName.ERC721CollectionV2,
      chainId,
      getContract(ContractName.ERC721CollectionV2, chainId as ChainId),
      address
    )
  } catch {
    return null
  }
}

/**
 * Resolves whether `address` is a Decentraland contract on `chainId`: the static registry first, then,
 * on the meta-transaction chain only, the collection lookup (wearable collections are deployed per
 * collection by the collection factories and are not in the registry). A lookup that fails or times out
 * resolves to `unavailable`, never to `not_found`.
 */
async function resolveKnownDecentralandContract(
  address: string,
  chainId: number,
  { metaTransactionChainId, isCollection }: ResolveContractDependencies
): Promise<ContractResolution> {
  const known = getKnownDecentralandContract(address, chainId)
  if (known) {
    return { status: 'found', contract: known }
  }
  if (chainId !== metaTransactionChainId) {
    return { status: 'not_found' }
  }
  const collection = getCollectionContract(address, chainId)
  if (!collection) {
    return { status: 'not_found' }
  }
  let lookup: boolean | 'unavailable'
  try {
    lookup = await isCollection(address)
  } catch {
    lookup = 'unavailable'
  }
  if (lookup === 'unavailable') {
    return { status: 'unavailable' }
  }
  return lookup ? { status: 'found', contract: collection } : { status: 'not_found' }
}

/**
 * Decodes `data` against the contract's ABI and proves the decode is exact: the arguments are
 * re-encoded and must reproduce the input byte for byte. viem alone accepts trailing bytes, extra
 * words and dirty address padding, any of which would let calldata that reads as one call execute
 * as something else; viem's encoder also range-checks every word, so a value with dirty high bits
 * (a `uint8` above 255, a `bool` that is not 0 or 1) never re-encodes. Returns null for anything
 * that is not a canonical call to a known function.
 */
function decodeKnownContractCall(contract: KnownContract, data: string): DecodedCall | null {
  if (!CALLDATA_REGEX.test(data)) {
    return null
  }
  // viem matches selectors and hex case-sensitively; the bytes are the same whatever the casing.
  const normalized: `0x${string}` = `0x${data.slice(2).toLowerCase()}`
  const selector = normalized.slice(0, 10)
  const item = contract.abi.find(
    (candidate): candidate is AbiFunction => isAbiFunction(candidate) && toFunctionSelector(candidate) === selector
  )
  if (!item) {
    return null
  }
  try {
    const { args } = decodeFunctionData({ abi: [item], data: normalized })
    const encoded = encodeFunctionData({ abi: [item], functionName: item.name, args } as Parameters<typeof encodeFunctionData>[0])
    if (encoded.toLowerCase() !== normalized) {
      return null
    }
    const payable = item.stateMutability === 'payable'
    return { functionName: item.name, args: args ?? [], payable, forwardsCall: payable || FORWARDING_FUNCTIONS.has(item.name) }
  } catch {
    return null
  }
}

// A nested call as Decentraland contracts carry one: the CreditsManager's `externalCall` names a target, a
// selector and the ABI-encoded arguments, and runs `target.call(selector ++ data)`.
type ExternalCallLike = { target: string; selector: string; data: string }

const SELECTOR_REGEX = /^0x[0-9a-fA-F]{8}$/
const BYTES_REGEX = /^0x([0-9a-fA-F]{2})*$/
// Nesting is bounded by the registry ABIs, not by calldata; this only stops a pathological chain of contracts.
const MAX_NESTED_CALL_DEPTH = 3

function isExternalCallLike(value: Record<string, unknown>): value is Record<string, unknown> & ExternalCallLike {
  return (
    typeof value.target === 'string' &&
    ADDRESS_REGEX.test(value.target) &&
    typeof value.selector === 'string' &&
    SELECTOR_REGEX.test(value.selector) &&
    typeof value.data === 'string' &&
    BYTES_REGEX.test(value.data)
  )
}

/** What a call reaches: every address in its arguments, and whether any nested payload could not be read. */
type CallAddresses = { addresses: Set<string>; opaque: boolean }

function collectInto(value: unknown, chainId: number, depth: number, result: CallAddresses): void {
  if (typeof value === 'string') {
    if (ADDRESS_REGEX.test(value)) result.addresses.add(value.toLowerCase())
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectInto(item, chainId, depth, result))
    return
  }
  if (!isRecord(value)) return
  if (isExternalCallLike(value)) {
    // The target is a counterparty in its own right; the payload it runs is read only when the target is a
    // Decentraland contract whose ABI decodes it canonically. Anything else stays unread, and unread means
    // the preview cannot be vouched for.
    result.addresses.add(value.target.toLowerCase())
    const target = getKnownDecentralandContract(value.target, chainId)
    const nested =
      target && depth < MAX_NESTED_CALL_DEPTH ? decodeKnownContractCall(target, `${value.selector}${value.data.slice(2)}`) : null
    if (!nested || nested.forwardsCall) {
      result.opaque = true
    } else if (!NON_CALLING_FUNCTIONS.has(nested.functionName)) {
      collectInto(nested.args, chainId, depth + 1, result)
    }
    return
  }
  Object.values(value).forEach(item => collectInto(item, chainId, depth, result))
}

/**
 * Every address a decoded Decentraland call reaches, lowercased: the addresses in its arguments, walking
 * arrays and structs, and following a nested call (an `externalCall` struct) into the call it carries when
 * its target is a Decentraland contract on `chainId` and the payload decodes against that contract's ABI.
 * A function that never calls its address arguments (see NON_CALLING_FUNCTIONS) reaches nothing, at the top
 * level and nested alike. `opaque` is true when a nested payload could not be read: it may name addresses
 * this walk cannot see, so the caller must not vouch for what the call reaches. Only calldata declared as a
 * nested call is followed: a plain `bytes` argument (a safe transfer's `data`, a factory's `createCollection`
 * initializer, a trade's `extra`) is not a call this page is asked to review, see FORWARDING_FUNCTIONS for
 * the ones that are refused outright.
 */
function collectCallAddresses(call: DecodedCall, chainId: number): CallAddresses {
  const result: CallAddresses = { addresses: new Set<string>(), opaque: false }
  if (!NON_CALLING_FUNCTIONS.has(call.functionName)) {
    collectInto(call.args, chainId, 0, result)
  }
  return result
}

export {
  collectCallAddresses,
  decodeKnownContractCall,
  getCollectionContract,
  getKnownDecentralandContract,
  getMetaTransactionCalldataField,
  getMetaTransactionSalt,
  getStaticContractIndex,
  isRecognizedDecentralandContract,
  resolveKnownDecentralandContract
}
export type { CallAddresses, CollectionLookup, ContractResolution, DecodedCall, KnownContract, ResolveContractDependencies }
