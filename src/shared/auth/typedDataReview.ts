import { getTypesForEIP712Domain, hashTypedData } from 'viem'
import { ADDRESS_REGEX } from './address'
import { EIP712_DOMAIN_FIELD_TYPES } from './eip712Domain'
import { MalformedSignatureRequestError } from './errors'

type Field = { name: string; type: string }
type TypedDataReviewNode = Field & { value?: string; children?: TypedDataReviewNode[] }
type TypedDataReview = {
  primaryType: string
  /** The signed domain fields in the form the review shows: strings escaped, integers decimal. */
  domain: Record<string, string>
  fields: TypedDataReviewNode[]
  hash: string
}

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const INTEGER =
  /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/
const BYTES = /^bytes([1-9]|[12][0-9]|3[0-2])?$/
const ARRAY = /^(.*)\[([1-9][0-9]*)?\]$/
// Sizes past which a value is not reviewed, measured on the text as it will be shown, escapes included. No string
// or bytes a person is asked to read is this long, and the request transport carries at most a megabyte. They
// keep escaping, rendering and hashing bounded before the user can decline.
const MAX_SCALAR_LENGTH = 64 * 1024
const MAX_TOTAL_LENGTH = 512 * 1024
// More struct definitions than any schema needs; the largest in the wild declare a dozen or two.
const MAX_TYPE_DEFINITIONS = 256
// Characters a rendered string cannot show faithfully: controls (tab, newline and carriage return among
// them, which the page would otherwise collapse into plain spacing), format characters such as the bidi
// overrides that reorder their neighbours, separators, unassigned code points and U+FFFD. The backslash is
// escaped too, so a signed string cannot spell out an escape of its own and the display stays unambiguous.
const UNREADABLE_CHARACTER = /[\\\p{C}\p{Zl}\p{Zp}�]/gu
const SHORT_ESCAPES: ReadonlyMap<string, string> = new Map([
  ['\\', '\\\\'],
  ['\t', '\\t'],
  ['\n', '\\n'],
  ['\r', '\\r']
])
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
// Counts an object's own keys only up to a limit, so one with far more keys than the review could accept
// is turned away without first listing them all.
const hasMoreKeysThan = (value: object, limit: number): boolean => {
  let count = 0
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key) && ++count > limit) return true
  }
  return false
}
const isScalar = (type: string): boolean => ['address', 'bool', 'string'].includes(type) || INTEGER.test(type) || BYTES.test(type)
/**
 * Shows every character of a signed string, including the ones that would otherwise reorder, hide or
 * merge with their neighbours, as a visible escape: the usual short forms for backslash, tab, newline and
 * carriage return, `\\u{…}` for the rest. Only the display changes; the signed bytes are untouched.
 */
const escapeUnreadable = (text: string): string =>
  text.replace(UNREADABLE_CHARACTER, character => SHORT_ESCAPES.get(character) ?? `\\u{${(character.codePointAt(0) ?? 0).toString(16)}}`)

/**
 * Validates generic EIP-712 data and builds its review from the signed schema, never from arbitrary
 * message properties. Only what the signature reaches is held to the rules: the primary type, every
 * struct it references, and the domain. A struct the primary type never reaches is not signed, so it is
 * neither validated nor shown. Within what is signed, undeclared or missing fields, ambiguous scalar
 * coercions and a domain the encoder would only partially sign are rejected, because the review could
 * not then show exactly what is signed. This does not establish a permit's or an order's safety; the
 * signature-risk acknowledgments still apply. The original request is never rewritten.
 * The domain comes back in the same display form as the fields, never as the payload's own object: its
 * name and version are what a request would forge to look like a trusted application.
 * Depth, work and size limits bound the traversal, escaping, rendering and hashing of untrusted structures:
 * every container is bounded before it is enumerated, and the digest is taken over the validated
 * representation rather than the request object as received.
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
  let budget = 10000
  const spend = (depth: number) => {
    if (depth > 32 || --budget < 0) reject('typed data is too complex to review')
  }
  let remainingLength = MAX_TOTAL_LENGTH
  const charge = (length: number) => {
    remainingLength -= length
    if (remainingLength < 0) reject('typed data is too large to review')
  }
  // Every string the payload carries, names and values alike, is measured before it is examined further.
  const measure = (text: string) => {
    if (text.length > MAX_SCALAR_LENGTH) reject('a typed-data value is too long to review')
    charge(text.length)
  }

  // Definitions are read leniently: one that is malformed is left out, and only matters if the
  // signature reaches it, which the walk below detects as a reference to a type that does not exist.
  if (hasMoreKeysThan(typedData.types, MAX_TYPE_DEFINITIONS)) return reject('typed data declares too many types')
  const types = new Map<string, Field[]>()
  for (const [name, fields] of Object.entries(typedData.types)) {
    spend(0)
    measure(name)
    if (!IDENTIFIER.test(name) || !Array.isArray(fields)) continue
    const names = new Set<string>()
    const definition: Field[] = []
    let isWellFormed = true
    for (const field of fields) {
      spend(0)
      if (isRecord(field)) {
        for (const part of [field.name, field.type]) {
          if (typeof part === 'string') measure(part)
        }
      }
      if (
        !isRecord(field) ||
        typeof field.name !== 'string' ||
        !IDENTIFIER.test(field.name) ||
        typeof field.type !== 'string' ||
        names.has(field.name)
      ) {
        isWellFormed = false
        break
      }
      names.add(field.name)
      definition.push({ name: field.name, type: field.type })
    }
    if (isWellFormed) types.set(name, definition)
  }

  // Walk the types the signature covers, from the primary type down. EIP-712 v3 cannot sign arrays, and
  // a struct named like a built-in type would be encoded as a struct by some encoders and as the
  // built-in by others, so neither may appear where the signature reaches.
  const reachable = new Set<string>()
  const visitType = (type: string, depth: number): void => {
    spend(depth)
    const array = ARRAY.exec(type)
    if (array) {
      if (method.toLowerCase() === 'eth_signtypeddata_v3') reject('typed-data arrays require eth_signTypedData_v4')
      if (array[2] && !Number.isSafeInteger(Number(array[2]))) reject('typed data has an invalid array length')
      return visitType(array[1], depth + 1)
    }
    if (isScalar(type)) {
      if (types.has(type)) reject('a typed-data struct shadows a built-in type')
      return
    }
    const fields = types.get(type)
    if (!fields) return reject('typed data references an undefined or malformed type')
    if (reachable.has(type)) return
    reachable.add(type)
    for (const field of fields) visitType(field.type, depth + 1)
  }
  visitType(primaryType, 0)

  if (hasMoreKeysThan(domain, EIP712_DOMAIN_FIELD_TYPES.size)) return reject('the domain contains a non-standard field')
  const domainKeys = Object.keys(domain)
  if (domainKeys.some(key => !EIP712_DOMAIN_FIELD_TYPES.has(key))) return reject('the domain contains a non-standard field')
  if ('EIP712Domain' in typedData.types && !types.has('EIP712Domain')) return reject('the domain type is malformed')
  // Match the actual encoder's derivation when EIP712Domain is omitted. It can omit a string
  // chainId, so do not display such a value as if it bound the signature to a network.
  const domainFields: Field[] = types.get('EIP712Domain') ?? [...getTypesForEIP712Domain({ domain })]
  if (
    domainFields.length !== domainKeys.length ||
    domainFields.some(field => !domainKeys.includes(field.name) || EIP712_DOMAIN_FIELD_TYPES.get(field.name) !== field.type)
  ) {
    return reject('the domain type does not match the domain fields')
  }
  // Encoders disagree on a declaration in any order but the standard's: some hash the domain fields as
  // declared, others as EIP-712 lists them. Such a declaration could sign a digest other than the one
  // shown and acknowledged here, so only the order every encoder agrees on is accepted.
  const canonicalOrder = [...EIP712_DOMAIN_FIELD_TYPES.keys()].filter(name => domainKeys.includes(name))
  if (domainFields.some((field, index) => field.name !== canonicalOrder[index])) {
    return reject('the domain type does not list its fields in the order EIP-712 defines')
  }
  types.set('EIP712Domain', domainFields)

  const reviewValue = (name: string, type: string, value: unknown, depth: number): TypedDataReviewNode => {
    spend(depth)
    // Every node is rendered with its name and type, however many nodes reuse one declaration, so each
    // node's label counts toward what is held, not only the declaration that was measured once.
    charge(name.length + type.length)
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
      if (hasMoreKeysThan(value, fields.length) || fields.some(field => !Object.prototype.hasOwnProperty.call(value, field.name))) {
        return reject('a typed-data object does not match its declared fields')
      }
      return { name, type, children: fields.map(field => reviewValue(field.name, field.type, value[field.name], depth + 1)) }
    }
    if (typeof value === 'string') measure(value)
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
    if (type === 'string') {
      if (typeof value !== 'string') return reject('a typed-data value does not match its declared scalar type')
      // An escape is several characters long, and it is the escaped text that is held and rendered, so the
      // value is held to the caps again as shown.
      const shown = escapeUnreadable(value)
      if (shown.length > MAX_SCALAR_LENGTH) return reject('a typed-data value is too long to review')
      charge(shown.length - value.length)
      return { name, type, value: shown }
    }
    const bytes = BYTES.exec(type)
    if (
      (type === 'bool' && typeof value !== 'boolean') ||
      (type === 'address' && (typeof value !== 'string' || !ADDRESS_REGEX.test(value))) ||
      (bytes &&
        (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value) || (bytes[1] && value.length !== 2 + Number(bytes[1]) * 2)))
    ) {
      return reject('a typed-data value does not match its declared scalar type')
    }
    return { name, type, value: String(value) }
  }
  // Every domain field is a scalar, so each reviewed node carries its display value.
  const reviewedDomain = Object.fromEntries(
    (reviewValue('domain', 'EIP712Domain', domain, 0).children ?? []).map(node => [node.name, node.value ?? ''])
  )
  const fields = reviewValue('message', primaryType, message, 0).children ?? []
  // The digest is taken over what was validated, never the request object as received: the definitions
  // the signature reaches, the domain type as it is signed, and a domain and message whose every key has
  // been checked. EIP-712 hashes exactly that, so it equals the digest a wallet computes over the request.
  const signedTypes: Record<string, Field[]> = Object.fromEntries([...reachable].map(name => [name, types.get(name) ?? []]))
  signedTypes.EIP712Domain = domainFields
  let hash: string
  try {
    hash = hashTypedData({ primaryType, domain, message, types: signedTypes } as unknown as Parameters<typeof hashTypedData>[0])
  } catch {
    return reject('typed data cannot be encoded for signing')
  }
  return { primaryType, domain: reviewedDomain, fields, hash }
}

export { MAX_SCALAR_LENGTH, MAX_TOTAL_LENGTH, MAX_TYPE_DEFINITIONS, resolveTypedDataReview }
export type { TypedDataReview, TypedDataReviewNode }
