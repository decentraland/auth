import { hexToString, stringToHex } from 'viem'
import { ContractName, DOMAIN_TYPE } from 'decentraland-transactions'
import {
  ADDRESS_REGEX,
  ContractLookupUnavailableError,
  ContractResolution,
  DecodedCall,
  KnownContract,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
  RecoverResponse,
  UnsupportedMethodError,
  decodeKnownContractCall,
  getMetaTransactionSalt,
  isHexBytes,
  isMetaTransactionTypedData,
  parseChainId,
  resolveMetaTransactionTypedData
} from '../../../shared/auth'
import { SUPPORTED_CHAIN_IDS } from '../../../shared/chains'
import { HIDDEN_CHARACTER_PATTERN } from '../../../shared/text'
import { isRecord } from '../../../shared/utils/isRecord'
import { buildTransactionParams } from './transactionParams'
import { TypedDataPayload } from './types'

// Anything the user cannot see or read as text: the hidden characters (controls other than tab, newline and
// carriage return, format characters such as zero-width and bidi controls, surrogates, private-use and
// unassigned code points, the line and paragraph separators) and U+FFFD, which is what decoding bytes that
// are not valid UTF-8 produces.
const UNREADABLE_CHARACTER_REGEX = new RegExp(`${HIDDEN_CHARACTER_PATTERN}|\uFFFD`, 'u')

// The only collection calls the branded gift view may stand in for. Other functions on the CollectionV2
// ABI also take three or more arguments — batchTransferFrom, safeBatchTransferFrom, setItemsMinters,
// setItemsManagers, editItemsData — and would decode into a "to" and a "token id" as well, so without
// this check they would be shown as the gift of one token while doing something else. Shared with the
// decoder that reads the transfer out of the call, so the two cannot drift.
const NFT_TRANSFER_FUNCTIONS: ReadonlySet<string> = new Set(['transferFrom', 'safeTransferFrom'])

// The kinds whose request is an eth_sendTransaction: they carry a target and a value, and the user may
// pay gas for them. The one definition the page and the unverified view both read.
const TRANSACTION_KINDS: ReadonlySet<string> = new Set(['dcl_transaction', 'unknown_transaction', 'native_transfer'])

/** Which branded screen a Decentraland transaction may use instead of the generic simulation review. */
type BrandedTransaction = 'tip' | 'gift_candidate' | null

/**
 * Why a transaction was not previewed. Analytics only. A call to a Decentraland contract that deviates from
 * the shape the SDK builds is not among these: it is refused (see classifyTransaction).
 */
type UnknownTransactionReason = 'unknown_contract' | 'unverified_recipient'

/**
 * Why a well-formed MetaTransaction was not previewed. Analytics only. A MetaTransaction for a Decentraland
 * contract that deviates from the shape the SDK builds is not among these: it is refused (see
 * classifyTypedData); one for an unknown contract that is not even shaped like a MetaTransaction is plain
 * unknown typed data.
 */
type UnknownMetaTransactionReason = 'other_chain' | 'from_mismatch' | 'unknown_contract'

// What a MetaTransaction payload built by decentraland-transactions carries, and nothing else: the four EIP-712
// members, and the domain and MetaTransaction structs. EIP-712 signs neither an extra top-level key nor a struct
// the primary type does not reach, so anything more is unsigned text riding along with the request.
const TYPED_DATA_KEYS: ReadonlySet<string> = new Set(['types', 'domain', 'primaryType', 'message'])
const META_TRANSACTION_TYPE_NAMES: ReadonlySet<string> = new Set(['EIP712Domain', 'MetaTransaction'])

/**
 * What a recovered request is, decided once before any view renders. The kind chooses the view, the
 * acknowledgment gates and what the approve button dispatches; nothing is re-derived at approval.
 *
 * Only the `dcl_*` kinds are previewed. Everything else is shown as exactly what it is: a request
 * Decentraland cannot check, with a warning, a mandatory acknowledgment and the raw payload.
 */
type RequestClassification =
  | {
      kind: 'dcl_transaction'
      contract: KnownContract
      call: DecodedCall
      to: string
      data: string
      value: string
      /** The chain the call executes on: the meta-transaction chain when relayed, else the connected chain. */
      chainId: number
      /** Relayed through the gas tank as a meta-transaction (gas covered). Only a Decentraland call can be. */
      relayed: boolean
      branded: BrandedTransaction
    }
  | { kind: 'native_transfer'; to: string; value: string; chainId: number; toSelf: boolean }
  | { kind: 'unknown_transaction'; to: string; data: string; value: string; chainId: number; reason: UnknownTransactionReason }
  | {
      kind: 'dcl_meta_transaction'
      contract: KnownContract
      call: DecodedCall
      calldata: string
      chainId: number
      typedData: TypedDataPayload
      raw: string
    }
  | {
      kind: 'unknown_meta_transaction'
      typedData: TypedDataPayload
      raw: string
      verifyingContract: string | null
      chainId: number | null
      reason: UnknownMetaTransactionReason
    }
  | { kind: 'unknown_typed_data'; typedData: TypedDataPayload; raw: string }
  | { kind: 'personal_sign'; text: string | null; hex: string }

type ClassificationContext = {
  /** The connected account. The only account a request executes for, whatever the request says. */
  signerAddress: string
  /** The chain the wallet is on. A plain transaction executes here. */
  connectedChainId: number
  /** The chain meta-transactions are relayed on (Polygon, or Amoy outside production). */
  metaTransactionChainId: number
  /** True only when a trusted RPC confirms the recipient has no code on the execution chain. */
  isAddressWithoutCode: (address: string, chainId: number) => Promise<boolean>
  resolveContract: (address: string, chainId: number) => Promise<ContractResolution>
}

/** The two previewed kinds: a call to a Decentraland contract, simulated and decoded. */
type DecentralandClassification = Extract<RequestClassification, { kind: 'dcl_transaction' | 'dcl_meta_transaction' }>

/** The kinds that send a transaction, whatever the target. */
type TransactionClassification = Extract<RequestClassification, { kind: 'dcl_transaction' | 'unknown_transaction' | 'native_transfer' }>

/** Whether the classification is one of the previewed Decentraland kinds. */
function isDecentralandClassification(classification: RequestClassification): classification is DecentralandClassification {
  return classification.kind === 'dcl_transaction' || classification.kind === 'dcl_meta_transaction'
}

/** Whether a kind sends a transaction (as opposed to producing a signature). */
function isTransactionKind(kind: RequestClassification['kind']): boolean {
  return TRANSACTION_KINDS.has(kind)
}

/** Whether the classification sends a transaction (as opposed to producing a signature). */
function isTransactionClassification(classification: RequestClassification): classification is TransactionClassification {
  return isTransactionKind(classification.kind)
}

/** Whether the typed data carries the MetaTransaction and nothing else (see TYPED_DATA_KEYS). */
function carriesOnlyTheMetaTransaction(typedData: TypedDataPayload): boolean {
  return (
    Object.keys(typedData).every(key => TYPED_DATA_KEYS.has(key)) &&
    isRecord(typedData.types) &&
    Object.keys(typedData.types).every(name => META_TRANSACTION_TYPE_NAMES.has(name))
  )
}

/**
 * Whether `domain` is exactly the domain the contract hashes: the four fields decentraland-transactions
 * puts in every domain (`name`, `version`, `verifyingContract`, `salt`) with the registry's values, and
 * nothing else; and a declared struct that is exactly the library's `DOMAIN_TYPE`. A domain that
 * differs produces a signature the contract rejects, which is harmless, but it must not be shown under
 * a Decentraland preview either.
 */
function isDecentralandDomain(typedData: TypedDataPayload, contract: KnownContract, chainId: number): boolean {
  const domain = typedData.domain
  if (!isRecord(domain)) {
    return false
  }
  const keys = Object.keys(domain)
  if (keys.length !== 4 || !['name', 'version', 'verifyingContract', 'salt'].every(key => keys.includes(key))) {
    return false
  }
  if (domain.name !== contract.domainName || domain.version !== contract.domainVersion) {
    return false
  }
  if (typeof domain.verifyingContract !== 'string' || domain.verifyingContract.toLowerCase() !== contract.address) {
    return false
  }
  if (typeof domain.salt !== 'string' || domain.salt.toLowerCase() !== getMetaTransactionSalt(chainId)) {
    return false
  }
  const domainType: unknown = typedData.types?.EIP712Domain
  return (
    Array.isArray(domainType) &&
    domainType.length === DOMAIN_TYPE.length &&
    DOMAIN_TYPE.every((expected, index) => {
      const field: unknown = domainType[index]
      return isRecord(field) && field.name === expected.name && field.type === expected.type
    })
  )
}

async function classifyTransaction(method: string, params: unknown[], context: ClassificationContext): Promise<RequestClassification> {
  const [transaction] = buildTransactionParams(params)
  const to = transaction.to as string
  const data = transaction.data as string
  const value = transaction.value as string
  const connectedChainId = context.connectedChainId

  if (data === '0x') {
    // Empty calldata still executes a contract's receive/fallback function (including delegated
    // EIP-7702 code). Only a confirmed account without code gets the simple-transfer review.
    // A failed lookup retains the unknown-contract warnings and never changes the execution chain.
    let withoutCode = false
    try {
      withoutCode = await context.isAddressWithoutCode(to, connectedChainId)
    } catch {
      // The recipient could not be checked; its effects remain unknown.
    }
    if (withoutCode !== true) {
      return { kind: 'unknown_transaction', to, data, value, chainId: connectedChainId, reason: 'unverified_recipient' }
    }
    return {
      kind: 'native_transfer',
      to,
      value,
      chainId: connectedChainId,
      toSelf: to.toLowerCase() === context.signerAddress.toLowerCase()
    }
  }

  // An eth_sendTransaction executes on the chain the wallet is on, so a Decentraland contract deployed
  // at `to` on that chain is what the request means (the registry has the same address on several
  // chains: OffChainMarketplaceV2 on Sepolia and Amoy). Only when the connected chain has no such
  // contract is a Decentraland contract on the meta-transaction chain that can execute meta-transactions
  // relayed through the gas tank instead. Anything else is unknown.
  let candidate: { contract: KnownContract; relayed: boolean; chainId: number } | null = null
  if (connectedChainId !== context.metaTransactionChainId) {
    const onConnectedChain = await context.resolveContract(to, connectedChainId)
    // Registry-only today, so never unavailable; kept explicit so the invariant that a failed lookup
    // is not a verdict holds if this path ever asks a network.
    if (onConnectedChain.status === 'unavailable') {
      throw new ContractLookupUnavailableError(to)
    }
    if (onConnectedChain.status === 'found') {
      candidate = { contract: onConnectedChain.contract, relayed: false, chainId: connectedChainId }
    }
  }
  if (!candidate) {
    const onRelayChain = await context.resolveContract(to, context.metaTransactionChainId)
    if (onRelayChain.status === 'unavailable') {
      throw new ContractLookupUnavailableError(to)
    }
    if (onRelayChain.status === 'found' && onRelayChain.contract.supportsMetaTransactions) {
      candidate = { contract: onRelayChain.contract, relayed: true, chainId: context.metaTransactionChainId }
    } else if (onRelayChain.status === 'found' && connectedChainId === context.metaTransactionChainId) {
      candidate = { contract: onRelayChain.contract, relayed: false, chainId: connectedChainId }
    }
  }

  if (!candidate) {
    return { kind: 'unknown_transaction', to, data, value, chainId: connectedChainId, reason: 'unknown_contract' }
  }

  // The target is a Decentraland contract. Every legitimate call to one is built by the SDK as a canonical,
  // non-payable, zero-value call, so a payload that deviates is broken or hostile, and the chain would still
  // run it (the EVM ignores trailing calldata). It is refused, not shown under the unverified warnings, whose
  // copy ("not a call to a Decentraland contract") would be false for it.
  const reject = (reason: string): never => {
    throw new MalformedTransactionRequestError(method, reason)
  }
  const call = decodeKnownContractCall(candidate.contract, data)
  if (!call) {
    return reject(`the calldata is not a call the Decentraland ${candidate.contract.name} contract declares`)
  }
  if (call.forwardsCall) {
    return reject(
      `${call.functionName} on the Decentraland ${candidate.contract.name} contract forwards another call and cannot be reviewed`
    )
  }
  if (BigInt(value) !== 0n) {
    return reject(`a call to the Decentraland ${candidate.contract.name} contract cannot carry a value`)
  }

  let branded: BrandedTransaction = null
  if (candidate.relayed && candidate.contract.name === ContractName.MANAToken && call.functionName === 'transfer') {
    branded = 'tip'
  } else if (
    candidate.relayed &&
    candidate.contract.name === ContractName.ERC721CollectionV2 &&
    NFT_TRANSFER_FUNCTIONS.has(call.functionName)
  ) {
    branded = 'gift_candidate'
  }
  return {
    kind: 'dcl_transaction',
    contract: candidate.contract,
    call,
    to,
    data,
    value,
    chainId: candidate.chainId,
    relayed: candidate.relayed,
    branded
  }
}

async function classifyTypedData(method: string, params: unknown[], context: ClassificationContext): Promise<RequestClassification> {
  // The recover guard has already pinned the params to [signer, typed data] with a string primaryType.
  const param: unknown = params[1]
  let parsed: unknown = param
  if (typeof param === 'string') {
    try {
      parsed = JSON.parse(param)
    } catch {
      parsed = null
    }
  }
  const typedData: TypedDataPayload = isRecord(parsed) ? (parsed as TypedDataPayload) : {}
  // The JSON the wallet is handed and the review displays: the parsed structure serialized once, so the
  // wallet reads exactly what was checked here (a key the request gave twice reaches it once, with the
  // value kept here) rather than re-parsing the request's own text. Text that is not JSON stays as sent;
  // the wallet refuses it.
  const raw = isRecord(parsed) ? JSON.stringify(parsed) : typeof param === 'string' ? param : JSON.stringify(param)

  if (!isMetaTransactionTypedData(typedData)) {
    return { kind: 'unknown_typed_data', typedData, raw }
  }

  // The contract the request claims to sign for. Only an address counts: the domain is unvalidated at this
  // point, so any other string would put text the scene wrote on the fact line that names the contract.
  const claimedContract =
    isRecord(typedData.domain) &&
    typeof typedData.domain.verifyingContract === 'string' &&
    ADDRESS_REGEX.test(typedData.domain.verifyingContract)
      ? typedData.domain.verifyingContract
      : null

  // Whether Decentraland vouches for that contract decides what a deviation from the shape the SDK builds
  // means. For a contract it does not recognize, the signature is shown as what it is: one Decentraland
  // cannot check. For a contract it does, a deviating payload is broken or hostile, and since EIP-712 signs
  // only what the struct declares it may still verify on that contract, so it is refused rather than shown
  // under the unverified warnings, whose copy ("a contract Decentraland doesn't recognize") would be false
  // for it. The contract is looked up on the chain the domain names as well as on the relay chain: the
  // Ethereum Rentals contract verifies meta-transactions too, and a signature for it is one Decentraland
  // recognizes even though the relay never submits there. A domain that names no chain is checked against
  // every chain the page knows, so such an address is recognized wherever it is deployed. A lookup that
  // cannot answer is not a verdict.
  const domain: unknown = typedData.domain
  const claimedChainId = isRecord(domain) ? (parseChainId(domain.salt) ?? parseChainId(domain.chainId) ?? null) : null
  let knownContract: KnownContract | null = null
  if (claimedContract) {
    const chainsToCheck =
      claimedChainId === null
        ? [...SUPPORTED_CHAIN_IDS.filter(chainId => chainId !== context.metaTransactionChainId), context.metaTransactionChainId]
        : claimedChainId !== context.metaTransactionChainId
          ? [claimedChainId, context.metaTransactionChainId]
          : [context.metaTransactionChainId]
    for (const chainId of chainsToCheck) {
      const resolution = await context.resolveContract(claimedContract, chainId)
      if (resolution.status === 'unavailable') {
        throw new ContractLookupUnavailableError(claimedContract)
      }
      if (resolution.status === 'found') {
        knownContract = resolution.contract
        break
      }
    }
  }

  const reject = (reason: string): never => {
    throw new MalformedSignatureRequestError(method, reason)
  }

  let resolved: ReturnType<typeof resolveMetaTransactionTypedData>
  try {
    resolved = resolveMetaTransactionTypedData(typedData, method)
  } catch (error) {
    if (knownContract) {
      throw error instanceof MalformedSignatureRequestError
        ? error
        : new MalformedSignatureRequestError(method, 'the MetaTransaction is malformed')
    }
    // Not shaped like the MetaTransaction any Decentraland contract signs, for a contract Decentraland does
    // not know. Nothing about it is a meta-transaction Auth can describe, not even which contract it binds
    // to, so it is shown as the typed data it is, raw, rather than under meta-transaction facts.
    return { kind: 'unknown_typed_data', typedData, raw }
  }
  // Well-formed, so the resolved contract and chain are what the signature covers, and can be shown as facts.
  const unknown = (reason: UnknownMetaTransactionReason): RequestClassification => ({
    kind: 'unknown_meta_transaction',
    typedData,
    raw,
    verifyingContract: resolved.verifyingContract,
    chainId: resolved.chainId,
    reason
  })
  if (resolved.chainId !== context.metaTransactionChainId) {
    return knownContract ? reject(`Decentraland does not relay meta-transactions on chain ${resolved.chainId}`) : unknown('other_chain')
  }
  if (resolved.from.toLowerCase() !== context.signerAddress.toLowerCase()) {
    return knownContract ? reject('the MetaTransaction is for another account') : unknown('from_mismatch')
  }
  if (!knownContract) {
    return unknown('unknown_contract')
  }
  if (!knownContract.supportsMetaTransactions) {
    return reject(`the Decentraland ${knownContract.name} contract does not execute meta-transactions`)
  }
  if (knownContract.calldataField !== resolved.calldataField) {
    return reject('the MetaTransaction struct is not the one the contract hashes')
  }
  if (!isDecentralandDomain(typedData, knownContract, resolved.chainId)) {
    return reject('the MetaTransaction domain is not the one the contract hashes')
  }
  if (!carriesOnlyTheMetaTransaction(typedData)) {
    return reject('the typed data carries more than the MetaTransaction')
  }
  const call = decodeKnownContractCall(knownContract, resolved.calldata)
  if (!call) {
    return reject(`the MetaTransaction calldata is not a call the Decentraland ${knownContract.name} contract declares`)
  }
  if (call.forwardsCall) {
    return reject(`${call.functionName} forwards another call and cannot be reviewed`)
  }
  return {
    kind: 'dcl_meta_transaction',
    contract: knownContract,
    call,
    calldata: resolved.calldata,
    chainId: resolved.chainId,
    typedData,
    raw
  }
}

function classifyPersonalSign(params: unknown[]): RequestClassification {
  // The recover guard has already pinned the params to [message, signer].
  const message = typeof params[0] === 'string' ? params[0] : ''
  let hex: string
  let text: string | null
  if (isHexBytes(message)) {
    // Wallets sign `0x…` as bytes, so the text is what those bytes decode to, if they are text at all.
    // Anything else — plain text, a `0X…` string, the bare `0x` — a wallet signs as the UTF-8 of its
    // characters, and the same predicate decides that in toWalletSignatureRequest, so what is shown
    // here is what is signed.
    hex = message.toLowerCase()
    try {
      text = hexToString(hex as `0x${string}`)
    } catch {
      text = null
    }
  } else {
    hex = stringToHex(message)
    text = message
  }
  if (text !== null && UNREADABLE_CHARACTER_REGEX.test(text)) {
    text = null
  }
  return { kind: 'personal_sign', text, hex }
}

/**
 * Classifies a recovered request. Runs once, after the recover guards and before any view renders.
 * Throws {@link ContractLookupUnavailableError} when a target could not be checked against the
 * collection registry, so the page can show a retryable error instead of a review, and
 * {@link MalformedTransactionRequestError} or {@link MalformedSignatureRequestError} when the request
 * is aimed at a Decentraland contract but deviates from the shape the SDK builds, so the page rejects
 * it instead of showing it as a request Decentraland cannot check.
 */
async function classifyRequest(request: RecoverResponse, context: ClassificationContext): Promise<RequestClassification> {
  const params = request.params ?? []
  switch (request.method) {
    case 'eth_sendTransaction':
      return classifyTransaction(request.method, params, context)
    case 'personal_sign':
      return classifyPersonalSign(params)
    case 'eth_signTypedData_v3':
    case 'eth_signTypedData_v4':
      return classifyTypedData(request.method, params, context)
    default:
      // The recover guard rejects anything else before it gets here.
      throw new UnsupportedMethodError(request.method)
  }
}

/**
 * A stable fingerprint of the payload the wallet will be handed: the acknowledgment checkbox folds it
 * into the statement the user ticks, so a tick can never carry over to a different payload.
 */
function getPayloadFingerprint(classification: RequestClassification): string {
  switch (classification.kind) {
    case 'dcl_transaction':
    case 'unknown_transaction':
      return [classification.to.toLowerCase(), classification.data.toLowerCase(), classification.value, classification.chainId].join('|')
    case 'native_transfer':
      return [classification.to.toLowerCase(), '0x', classification.value, classification.chainId].join('|')
    case 'dcl_meta_transaction':
    case 'unknown_meta_transaction':
    case 'unknown_typed_data':
      return classification.raw
    case 'personal_sign':
      return classification.hex
  }
}

/** The analytics-safe summary of a classification: kinds, contract and function names and reasons, never payloads. */
function describeClassification(classification: RequestClassification): Record<string, string | boolean | null> {
  switch (classification.kind) {
    case 'dcl_transaction':
      return {
        kind: classification.kind,
        contractName: classification.contract.name,
        functionName: classification.call.functionName,
        relayed: classification.relayed,
        branded: classification.branded
      }
    case 'dcl_meta_transaction':
      return { kind: classification.kind, contractName: classification.contract.name, functionName: classification.call.functionName }
    case 'unknown_transaction':
    case 'unknown_meta_transaction':
      return { kind: classification.kind, reason: classification.reason }
    default:
      return { kind: classification.kind }
  }
}

export {
  NFT_TRANSFER_FUNCTIONS,
  classifyRequest,
  describeClassification,
  getPayloadFingerprint,
  isDecentralandClassification,
  isTransactionClassification,
  isTransactionKind
}
export type {
  BrandedTransaction,
  ClassificationContext,
  DecentralandClassification,
  RequestClassification,
  TransactionClassification,
  UnknownMetaTransactionReason,
  UnknownTransactionReason
}
