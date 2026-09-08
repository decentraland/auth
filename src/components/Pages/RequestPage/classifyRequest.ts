import { hashTypedData, hexToString, stringToHex } from 'viem'
import { ContractName, DOMAIN_TYPE } from 'decentraland-transactions'
import {
  ContractLookupUnavailableError,
  ContractResolution,
  DecodedCall,
  KnownContract,
  RecoverResponse,
  UnsupportedMethodError,
  decodeKnownContractCall,
  getMetaTransactionSalt,
  isMetaTransactionTypedData,
  resolveMetaTransactionTypedData
} from '../../../shared/auth'
import { buildTransactionParams } from './transactionParams'
import { TypedDataPayload } from './types'

// Hex-encoded bytes: `0x` and at least one whole byte. Case-insensitive on the prefix, like the guard.
const HEX_BYTES_REGEX = /^0x([0-9a-fA-F]{2})+$/i

// Anything the user cannot see or read as text, defined by Unicode category rather than by
// enumerated ranges: controls (C0 and C1), format characters such as zero-width and bidi controls,
// surrogates, private-use and unassigned code points, the line and paragraph separators, and U+FFFD,
// which is what decoding bytes that are not valid UTF-8 produces. Tab, newline and carriage return
// are the only controls a message may contain.
const UNREADABLE_CHARACTER_REGEX = /(?![\t\n\r])[\p{C}\p{Zl}\p{Zp}�]/u

// The collection calls the branded gift view may stand in for. Other CollectionV2 functions also take
// a recipient and a token id, so the check is on the name, not the shape.
const GIFT_FUNCTIONS = new Set(['transferFrom', 'safeTransferFrom'])

/** Which branded screen a Decentraland transaction may use instead of the generic simulation review. */
type BrandedTransaction = 'tip' | 'gift_candidate' | null

/** Why a transaction to a known-looking target was still classified as unknown. Analytics only. */
type UnknownTransactionReason = 'unknown_contract' | 'undecodable_call' | 'payable_call' | 'value_attached'

/** Why a MetaTransaction was not classified as a Decentraland one. Analytics only. */
type UnknownMetaTransactionReason =
  | 'malformed'
  | 'other_chain'
  | 'from_mismatch'
  | 'unknown_contract'
  | 'lookup_unavailable'
  | 'no_meta_transaction_support'
  | 'calldata_field_mismatch'
  | 'domain_mismatch'
  | 'undecodable_call'
  | 'payable_call'

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
  resolveContract: (address: string, chainId: number) => Promise<ContractResolution>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether `kind` is one of the previewed Decentraland kinds. */
function isDecentralandClassification(classification: RequestClassification): boolean {
  return classification.kind === 'dcl_transaction' || classification.kind === 'dcl_meta_transaction'
}

/**
 * Whether `domain` is exactly the domain the contract hashes: the four fields decentraland-transactions
 * puts in every domain (`name`, `version`, `verifyingContract`, `salt`) with the registry's values, and
 * nothing else; and, when the struct is declared, exactly the library's `DOMAIN_TYPE`. A domain that
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
  if (domainType === undefined) {
    return true
  }
  return (
    Array.isArray(domainType) &&
    domainType.length === DOMAIN_TYPE.length &&
    DOMAIN_TYPE.every((expected, index) => {
      const field: unknown = domainType[index]
      return isRecord(field) && field.name === expected.name && field.type === expected.type
    })
  )
}

async function classifyTransaction(params: unknown[], context: ClassificationContext): Promise<RequestClassification> {
  const [transaction] = buildTransactionParams(params)
  const to = transaction.to as string
  const data = transaction.data as string
  const value = transaction.value as string
  const connectedChainId = context.connectedChainId

  if (data === '0x') {
    return {
      kind: 'native_transfer',
      to,
      value,
      chainId: connectedChainId,
      toSelf: to.toLowerCase() === context.signerAddress.toLowerCase()
    }
  }

  // A Decentraland contract on the meta-transaction chain that can execute meta-transactions is relayed
  // through the gas tank whatever chain the wallet is on. Anything else executes on the connected chain
  // and is only Decentraland's if the registry says so for that chain.
  const onRelayChain = await context.resolveContract(to, context.metaTransactionChainId)
  if (onRelayChain.status === 'unavailable') {
    throw new ContractLookupUnavailableError(to)
  }
  let candidate: { contract: KnownContract; relayed: boolean; chainId: number } | null = null
  if (onRelayChain.status === 'found' && onRelayChain.contract.supportsMetaTransactions) {
    candidate = { contract: onRelayChain.contract, relayed: true, chainId: context.metaTransactionChainId }
  } else if (onRelayChain.status === 'found' && connectedChainId === context.metaTransactionChainId) {
    candidate = { contract: onRelayChain.contract, relayed: false, chainId: connectedChainId }
  } else if (connectedChainId !== context.metaTransactionChainId) {
    const onConnectedChain = await context.resolveContract(to, connectedChainId)
    if (onConnectedChain.status === 'found') {
      candidate = { contract: onConnectedChain.contract, relayed: false, chainId: connectedChainId }
    }
  }

  if (!candidate) {
    return { kind: 'unknown_transaction', to, data, value, chainId: connectedChainId, reason: 'unknown_contract' }
  }
  const call = decodeKnownContractCall(candidate.contract, data)
  if (!call) {
    return { kind: 'unknown_transaction', to, data, value, chainId: connectedChainId, reason: 'undecodable_call' }
  }
  if (call.payable) {
    return { kind: 'unknown_transaction', to, data, value, chainId: connectedChainId, reason: 'payable_call' }
  }
  if (BigInt(value) !== 0n) {
    return { kind: 'unknown_transaction', to, data, value, chainId: connectedChainId, reason: 'value_attached' }
  }

  let branded: BrandedTransaction = null
  if (candidate.relayed && candidate.contract.name === ContractName.MANAToken && call.functionName === 'transfer') {
    branded = 'tip'
  } else if (candidate.relayed && candidate.contract.name === ContractName.ERC721CollectionV2 && GIFT_FUNCTIONS.has(call.functionName)) {
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
  const raw = typeof param === 'string' ? param : JSON.stringify(param)
  let typedData: TypedDataPayload
  try {
    typedData = (typeof param === 'string' ? JSON.parse(param) : param) as TypedDataPayload
  } catch {
    typedData = {}
  }
  if (!isRecord(typedData)) {
    typedData = {}
  }

  if (!isMetaTransactionTypedData(typedData)) {
    return { kind: 'unknown_typed_data', typedData, raw }
  }

  const claimedContract =
    isRecord(typedData.domain) && typeof typedData.domain.verifyingContract === 'string' ? typedData.domain.verifyingContract : null
  const unknown = (
    reason: UnknownMetaTransactionReason,
    verifyingContract = claimedContract,
    chainId: number | null = null
  ): RequestClassification => ({
    kind: 'unknown_meta_transaction',
    typedData,
    raw,
    verifyingContract,
    chainId,
    reason
  })

  let resolved: ReturnType<typeof resolveMetaTransactionTypedData>
  try {
    resolved = resolveMetaTransactionTypedData(typedData, method)
  } catch {
    return unknown('malformed')
  }
  if (resolved.chainId !== context.metaTransactionChainId) {
    return unknown('other_chain', resolved.verifyingContract, resolved.chainId)
  }
  if (resolved.from.toLowerCase() !== context.signerAddress.toLowerCase()) {
    return unknown('from_mismatch', resolved.verifyingContract, resolved.chainId)
  }
  const resolution = await context.resolveContract(resolved.verifyingContract, resolved.chainId)
  if (resolution.status !== 'found') {
    return unknown(
      resolution.status === 'unavailable' ? 'lookup_unavailable' : 'unknown_contract',
      resolved.verifyingContract,
      resolved.chainId
    )
  }
  const { contract } = resolution
  if (!contract.supportsMetaTransactions) {
    return unknown('no_meta_transaction_support', resolved.verifyingContract, resolved.chainId)
  }
  if (contract.calldataField !== resolved.calldataField) {
    return unknown('calldata_field_mismatch', resolved.verifyingContract, resolved.chainId)
  }
  if (!isDecentralandDomain(typedData, contract, resolved.chainId)) {
    return unknown('domain_mismatch', resolved.verifyingContract, resolved.chainId)
  }
  const call = decodeKnownContractCall(contract, resolved.calldata)
  if (!call) {
    return unknown('undecodable_call', resolved.verifyingContract, resolved.chainId)
  }
  if (call.payable) {
    return unknown('payable_call', resolved.verifyingContract, resolved.chainId)
  }
  return { kind: 'dcl_meta_transaction', contract, call, calldata: resolved.calldata, chainId: resolved.chainId, typedData, raw }
}

function classifyPersonalSign(params: unknown[]): RequestClassification {
  // The recover guard has already pinned the params to [message, signer].
  const message = typeof params[0] === 'string' ? params[0] : ''
  let hex: string
  let text: string | null
  if (HEX_BYTES_REGEX.test(message)) {
    // Wallets sign hex as bytes, so the text is what those bytes decode to, if they are text at all.
    hex = `0x${message.slice(2).toLowerCase()}`
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
 * Throws {@link ContractLookupUnavailableError} when a transaction's target could not be checked
 * against the collection registry, so the page can show a retryable error instead of a review.
 */
async function classifyRequest(request: RecoverResponse, context: ClassificationContext): Promise<RequestClassification> {
  const params = request.params ?? []
  switch (request.method) {
    case 'eth_sendTransaction':
      return classifyTransaction(params, context)
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

/** The EIP-712 digest the wallet signs for `typedData`, or null when it cannot be hashed. */
function getTypedDataDigest(typedData: TypedDataPayload): string | null {
  try {
    return hashTypedData(typedData as unknown as Parameters<typeof hashTypedData>[0])
  } catch {
    return null
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
  UNREADABLE_CHARACTER_REGEX,
  classifyRequest,
  describeClassification,
  getPayloadFingerprint,
  getTypedDataDigest,
  isDecentralandClassification,
  isDecentralandDomain
}
export type { BrandedTransaction, ClassificationContext, RequestClassification, UnknownMetaTransactionReason, UnknownTransactionReason }
