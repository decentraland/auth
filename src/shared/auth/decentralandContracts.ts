import { Abi, AbiFunction, decodeFunctionData, encodeFunctionData, toFunctionSelector } from 'viem'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ContractData, ContractName, getContract } from 'decentraland-transactions'
import { SUPPORTED_CHAIN_IDS } from '../chains'
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
}

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
  const calldataField = getMetaTransactionCalldataField(abi)
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
      if (!entry.address) {
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
 * as something else. Returns null for anything that is not a canonical call to a known function.
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
    return { functionName: item.name, args: args ?? [], payable: item.stateMutability === 'payable' }
  } catch {
    return null
  }
}

export {
  decodeKnownContractCall,
  getCollectionContract,
  getKnownDecentralandContract,
  getMetaTransactionCalldataField,
  getMetaTransactionSalt,
  getStaticContractIndex,
  resolveKnownDecentralandContract
}
export type { CollectionLookup, ContractResolution, DecodedCall, KnownContract, ResolveContractDependencies }
