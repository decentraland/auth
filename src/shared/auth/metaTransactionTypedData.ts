import { hashTypedData } from 'viem'
import { META_TRANSACTION_TYPE, OFFCHAIN_META_TRANSACTION_TYPE } from 'decentraland-transactions'
import { MalformedSignatureRequestError } from './errors'

const META_TRANSACTION_PRIMARY_TYPE = 'MetaTransaction'
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/
// A 4-byte function selector followed by whole bytes of arguments.
const CALLDATA_REGEX = /^0x[0-9a-fA-F]{8}([0-9a-fA-F]{2})*$/

type TypedDataField = { name: string; type: string }

/** The `message` field that carries the inner call, as declared by the signed struct. */
type MetaTransactionCalldataField = 'functionSignature' | 'functionData'

type MetaTransactionSchema = { calldataField: MetaTransactionCalldataField; fields: readonly TypedDataField[] }

// The only two `MetaTransaction` structs a Decentraland contract hashes. Legacy contracts
// (collections, MANA, ...) execute `functionSignature`; the off-chain marketplace, rentals and
// credits manager execute `functionData`. Both come from the library that builds every legitimate
// payload, so this allowlist cannot drift from what the contracts actually verify.
const KNOWN_META_TRANSACTION_SCHEMAS: readonly MetaTransactionSchema[] = [
  { calldataField: 'functionSignature', fields: META_TRANSACTION_TYPE },
  { calldataField: 'functionData', fields: OFFCHAIN_META_TRANSACTION_TYPE }
]

/** The inner call a Decentraland meta-transaction signature authorizes, resolved from its typed data. */
type MetaTransactionTypedData = {
  calldataField: MetaTransactionCalldataField
  /** The call the contract will execute on the user's behalf — the only bytes the signature covers. */
  calldata: string
  /** The user the call executes for (`message.from`). */
  from: string
  /** The contract that verifies the signature and executes the call (`domain.verifyingContract`). */
  verifyingContract: string
  chainId: number
}

type TypedDataLike = { types?: unknown; domain?: unknown; primaryType?: unknown; message?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Returns whether the typed data declares the Decentraland meta-transaction struct. The match is
 * case-sensitive because the contracts hash the literal type name `MetaTransaction(...)`.
 */
function isMetaTransactionTypedData(typedData: unknown): typedData is TypedDataLike {
  return isRecord(typedData) && typedData.primaryType === META_TRANSACTION_PRIMARY_TYPE
}

/** Whether `fields` declares exactly `schema`: same fields, same types, same order. */
function matchesSchema(fields: unknown, schema: readonly TypedDataField[]): boolean {
  if (!Array.isArray(fields) || !Array.isArray(schema) || fields.length !== schema.length) {
    return false
  }
  return schema.every((expected, index) => {
    const field: unknown = fields[index]
    return isRecord(field) && field.name === expected.name && field.type === expected.type
  })
}

/**
 * Decentraland contracts encode the chain id in the domain `salt` (bytes32); `chainId` is the
 * standard EIP-712 fallback. Returns undefined when neither resolves to a usable chain id.
 */
function resolveChainId(domain: Record<string, unknown>): number | undefined {
  if (typeof domain.salt === 'string') {
    try {
      const fromSalt = Number(BigInt(domain.salt))
      if (Number.isSafeInteger(fromSalt) && fromSalt > 0) {
        return fromSalt
      }
    } catch {
      // Not a numeric salt — fall through to chainId.
    }
  }
  if (domain.chainId !== undefined) {
    const fromChainId = Number(domain.chainId)
    if (Number.isSafeInteger(fromChainId) && fromChainId > 0) {
      return fromChainId
    }
  }
  return undefined
}

/**
 * Resolves the inner call a Decentraland meta-transaction signature covers, or throws
 * {@link MalformedSignatureRequestError} when the typed data is not shaped the way a Decentraland
 * contract signs it.
 *
 * EIP-712 hashes only the fields `types[primaryType]` declares. Anything else in `message` is
 * ignored by the wallet, so a request could declare (and sign) one call while carrying a second,
 * undeclared call for the preview to simulate. The struct therefore decides which field is the
 * calldata, the message may hold nothing but the declared fields, and the request is finally
 * hashed the way the wallet will and compared with a payload rebuilt from the resolved fields
 * alone — equality proves the bytes handed to the simulation are the bytes the signature covers.
 * (Thirdweb signs through ox, which shares viem's EIP-712 encoding.)
 *
 * This is deliberately strict: every legitimate payload is built by decentraland-transactions with
 * exactly these shapes, so anything that deviates is either broken or hostile, and neither should
 * reach the wallet.
 */
function resolveMetaTransactionTypedData(typedData: unknown, method: string): MetaTransactionTypedData {
  const reject = (reason: string): never => {
    throw new MalformedSignatureRequestError(method, reason)
  }

  if (!isMetaTransactionTypedData(typedData)) {
    return reject('the typed data is not a MetaTransaction')
  }
  const { types, domain, message } = typedData
  if (!isRecord(types) || !isRecord(domain) || !isRecord(message)) {
    return reject('the MetaTransaction is missing its types, domain or message')
  }

  // 1. The signed struct must be one a Decentraland contract hashes. It names the calldata field.
  const schema = KNOWN_META_TRANSACTION_SCHEMAS.find(candidate => matchesSchema(types[META_TRANSACTION_PRIMARY_TYPE], candidate.fields))
  if (!schema) {
    return reject('the MetaTransaction struct is not one a Decentraland contract signs')
  }

  // 2. The message must carry exactly the declared fields. An undeclared field is never signed,
  //    so its only possible purpose is to mislead the preview.
  const declaredNames = schema.fields.map(field => field.name)
  const messageKeys = Object.keys(message)
  if (messageKeys.length !== declaredNames.length || declaredNames.some(name => !messageKeys.includes(name))) {
    return reject('the MetaTransaction message does not match the fields its struct declares')
  }

  const calldata = message[schema.calldataField]
  if (typeof calldata !== 'string' || !CALLDATA_REGEX.test(calldata)) {
    return reject('the MetaTransaction calldata is not a contract call')
  }
  const from = message.from
  if (typeof from !== 'string' || !ADDRESS_REGEX.test(from)) {
    return reject('the MetaTransaction sender is not an address')
  }
  const verifyingContract = domain.verifyingContract
  if (typeof verifyingContract !== 'string' || !ADDRESS_REGEX.test(verifyingContract)) {
    return reject('the MetaTransaction domain has no verifying contract')
  }
  const chainId = resolveChainId(domain)
  if (chainId === undefined) {
    return reject('the MetaTransaction domain has no chain id')
  }

  // 3. Prove the binding: hash the request as received and a payload rebuilt from nothing but the
  //    resolved fields. The wallet signs the former; the simulation runs the latter.
  const canonical = {
    domain,
    primaryType: META_TRANSACTION_PRIMARY_TYPE,
    types: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ...(types.EIP712Domain !== undefined ? { EIP712Domain: types.EIP712Domain } : {}),
      [META_TRANSACTION_PRIMARY_TYPE]: schema.fields
    },
    message: { nonce: message.nonce, from, [schema.calldataField]: calldata }
  }
  let requestHash: string
  let canonicalHash: string
  try {
    requestHash = hashTypedData(typedData as unknown as Parameters<typeof hashTypedData>[0])
    canonicalHash = hashTypedData(canonical as unknown as Parameters<typeof hashTypedData>[0])
  } catch {
    return reject('the MetaTransaction cannot be hashed the way the wallet would')
  }
  if (requestHash !== canonicalHash) {
    return reject('the MetaTransaction would sign different bytes than it declares')
  }

  return { calldataField: schema.calldataField, calldata, from, verifyingContract, chainId }
}

export { isMetaTransactionTypedData, resolveMetaTransactionTypedData }
export type { MetaTransactionCalldataField, MetaTransactionTypedData }
