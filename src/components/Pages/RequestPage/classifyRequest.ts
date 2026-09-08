import { hexToString, stringToHex } from 'viem'
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
  isHexBytes,
  isMetaTransactionTypedData,
  resolveMetaTransactionTypedData
} from '../../../shared/auth'
import { isRecord } from '../../../shared/utils/isRecord'
import { buildTransactionParams } from './transactionParams'
import { TypedDataPayload } from './types'

// Anything the user cannot see or read as text, defined by Unicode category rather than by
// enumerated ranges: controls (C0 and C1), format characters such as zero-width and bidi controls,
// surrogates, private-use and unassigned code points, the line and paragraph separators, and U+FFFD,
// which is what decoding bytes that are not valid UTF-8 produces. Tab, newline and carriage return
// are the only controls a message may contain.
const UNREADABLE_CHARACTER_REGEX = /(?![\t\n\r])[\p{C}\p{Zl}\p{Zp}�]/u

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

/** Why a transaction to a known-looking target was still classified as unknown. Analytics only. */
type UnknownTransactionReason = 'unknown_contract' | 'undecodable_call' | 'payable_call' | 'value_attached' | 'unverified_recipient'

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
