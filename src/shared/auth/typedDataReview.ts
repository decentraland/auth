import { getTypesForEIP712Domain, hashTypedData } from 'viem'
import { ADDRESS_REGEX } from './address'
import { MalformedSignatureRequestError } from './errors'

type Field = { name: string; type: string }
type TypedDataReviewNode = Field & { value?: string; children?: TypedDataReviewNode[] }
type TypedDataReview = {
  primaryType: string
  domain: Record<string, unknown>
  fields: TypedDataReviewNode[]
  hash: string
}

const DOMAIN_TYPES = new Map([
  ['name', 'string'],
  ['version', 'string'],
  ['chainId', 'uint256'],
  ['verifyingContract', 'address'],
  ['salt', 'bytes32']
])
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const INTEGER =
  /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/
const BYTES = /^bytes([1-9]|[12][0-9]|3[0-2])?$/
const ARRAY = /^(.*)\[([1-9][0-9]*)?\]$/
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isScalar = (type: string): boolean => ['address', 'bool', 'string'].includes(type) || INTEGER.test(type) || BYTES.test(type)

/**
 * Validates generic EIP-712 data and builds its review from the signed schema, never arbitrary
 * message properties. Rejects unsigned/missing fields recursively, ambiguous scalar coercions,
 * and domains the encoder would only partially sign. This does not establish a permit/order's
 * safety; existing signature-risk acknowledgments still apply. The original request is not rewritten.
 * Depth/work limits bound traversal of untrusted structures before hashing or rendering them.
 */
function resolveTypedDataReview(typedData: unknown, method: string): TypedDataReview {
  const reject = (reason: string): never => {
    throw new MalformedSignatureRequestError(method, reason)
  }
  if (!isRecord(typedData) || !isRecord(typedData.types) || !isRecord(typedData.domain) || !isRecord(typedData.message)) {
    return reject('typed data must include types, domain and message objects')
  }
  const { domain, message, primaryType } = typedData
  if (typeof primaryType !== 'string' || primaryType === 'EIP712Domain') {
    return reject('typed data must declare a message primaryType')
  }
  const types = new Map<string, Field[]>()
  let budget = 10000
  const spend = (depth: number) => {
    if (depth > 32 || --budget < 0) reject('typed data is too complex to review')
  }
  for (const [name, fields] of Object.entries(typedData.types)) {
    spend(0)
    if (!IDENTIFIER.test(name) || isScalar(name) || !Array.isArray(fields)) {
      return reject('typed data contains an invalid struct definition')
    }
    const names = new Set<string>()
    const definition: Field[] = []
    for (const field of fields) {
      spend(0)
      if (
        !isRecord(field) ||
        typeof field.name !== 'string' ||
        !IDENTIFIER.test(field.name) ||
        typeof field.type !== 'string' ||
        names.has(field.name)
      ) {
        return reject('typed data contains an invalid or duplicate field definition')
      }
      names.add(field.name)
      definition.push({ name: field.name, type: field.type })
    }
    types.set(name, definition)
  }
  // Check references even in empty arrays or unused structs. EIP-712 v3 cannot sign arrays.
  const validateType = (type: string, depth: number): void => {
    spend(depth)
    const array = ARRAY.exec(type)
    if (array) {
      if (method.toLowerCase() === 'eth_signtypeddata_v3') reject('typed-data arrays require eth_signTypedData_v4')
      if (array[2] && !Number.isSafeInteger(Number(array[2]))) reject('typed data has an invalid array length')
      validateType(array[1], depth + 1)
    } else if (!isScalar(type) && !types.has(type)) {
      reject('typed data references an undefined type')
    }
  }
  for (const fields of types.values()) {
    for (const field of fields) validateType(field.type, 0)
  }
  if (!types.has(primaryType)) return reject('typed data has no definition for its primaryType')

  const domainKeys = Object.keys(domain)
  if (domainKeys.some(key => !DOMAIN_TYPES.has(key))) return reject('the domain contains a non-standard field')
  // Match the actual encoder's derivation when EIP712Domain is omitted. It can omit a string
  // chainId, so do not display such a value as if it bound the signature to a network.
  const domainFields = types.get('EIP712Domain') ?? getTypesForEIP712Domain({ domain })
  if (
    domainFields.length !== domainKeys.length ||
    domainFields.some(field => !domainKeys.includes(field.name) || DOMAIN_TYPES.get(field.name) !== field.type)
  ) {
    return reject('the domain type does not match the domain fields')
  }
  types.set('EIP712Domain', domainFields)

  const reviewValue = (name: string, type: string, value: unknown, depth: number): TypedDataReviewNode => {
    spend(depth)
    const array = ARRAY.exec(type)
    if (array) {
      if (!Array.isArray(value) || (array[2] !== undefined && value.length !== Number(array[2]))) {
        return reject('a typed-data array does not match its declared type')
      }
      return { name, type, children: value.map((item, index) => reviewValue(`[${index}]`, array[1], item, depth + 1)) }
    }
    const fields = types.get(type)
    if (fields) {
      if (!isRecord(value)) return reject('a typed-data struct must be an object')
      const keys = Object.keys(value)
      if (keys.length !== fields.length || fields.some(field => !Object.prototype.hasOwnProperty.call(value, field.name))) {
        return reject('a typed-data object does not match its declared fields')
      }
      return { name, type, children: fields.map(field => reviewValue(field.name, field.type, value[field.name], depth + 1)) }
    }
    const integer = INTEGER.exec(type)
    if (integer) {
      if (
        !(
          (typeof value === 'number' && Number.isSafeInteger(value)) ||
          typeof value === 'bigint' ||
          (typeof value === 'string' && /^(?:-?[0-9]+|0x[0-9a-fA-F]+)$/.test(value))
        )
      ) {
        return reject('a typed-data integer is not an exact integer')
      }
      const number = BigInt(value)
      const bits = BigInt(integer[2])
      const signed = integer[1] === 'int'
      const limit = 1n << (signed ? bits - 1n : bits)
      if (number < (signed ? -limit : 0n) || number >= limit) return reject('a typed-data integer is out of range')
      return { name, type, value: number.toString() }
    }
    const bytes = BYTES.exec(type)
    if (
      (type === 'bool' && typeof value !== 'boolean') ||
      (type === 'string' && typeof value !== 'string') ||
      (type === 'address' && (typeof value !== 'string' || !ADDRESS_REGEX.test(value))) ||
      (bytes &&
        (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value) || (bytes[1] && value.length !== 2 + Number(bytes[1]) * 2)))
    ) {
      return reject('a typed-data value does not match its declared scalar type')
    }
    return { name, type, value: String(value) }
  }
  reviewValue('domain', 'EIP712Domain', domain, 0)
  const fields = reviewValue('message', primaryType, message, 0).children!
  let hash: string
  try {
    hash = hashTypedData(typedData as unknown as Parameters<typeof hashTypedData>[0])
  } catch {
    return reject('typed data cannot be encoded for signing')
  }
  return { primaryType, domain, fields, hash }
}

export { resolveTypedDataReview }
export type { TypedDataReview, TypedDataReviewNode }
