import { hexToString } from 'viem'
import { ADDRESS_REGEX } from './address'
import { ImpersonatedSignInError, MalformedSignatureRequestError, MalformedTransactionRequestError, UnsupportedMethodError } from './errors'

// The only methods the auth site is willing to forward to the connected wallet. Anything
// outside this set is rejected at recover time (see {@link assertMethodIsAllowed}).
//
// `dcl_personal_sign` is deliberately excluded: the sign-in flow it served was retired in
// favour of the identity handoff (`POST /identities` + the `open?signin=<id>` deep link), so
// the auth site no longer signs an identity-authorization payload under any method.
//
// `eth_sign` is deliberately excluded: unlike `personal_sign`, it signs a raw 32-byte digest
// with no EIP-191 (`\x19Ethereum Signed Message:\n`) prefix. That lets a request blind-sign an
// arbitrary hash — including a transaction hash, or the pre-computed digest of a Decentraland
// sign-in message. The latter would bypass `assertRequestIsNotImpersonatingSignIn`, which can
// only recognize a *plaintext* sign-in payload, not its hash. Major wallets deprecated
// `eth_sign` for the same reason.
//
// `eth_signTypedData` (v1) is excluded: no client uses it, Thirdweb cannot sign it, and its params are reversed.
const ALLOWED_METHODS = ['personal_sign', 'eth_signTypedData_v3', 'eth_signTypedData_v4', 'eth_sendTransaction']

// Lowercased method → its canonical EIP-1193 spelling, so the allowlist can stay forgiving about
// casing while everything downstream only ever sees the canonical form (see assertMethodIsAllowed).
const CANONICAL_METHODS_BY_LOWERCASE = new Map(ALLOWED_METHODS.map(method => [method.toLowerCase(), method]))

// The retired sign-in method. Named here only so a rejected request can be recognized as coming
// from a client that has not migrated to the identity handoff — it is NOT allowed, and this must
// never be added back to ALLOWED_METHODS.
const RETIRED_SIGN_IN_METHOD = 'dcl_personal_sign'

/**
 * Returns whether a rejected method is the retired Decentraland sign-in. Lets the request page
 * tell the user their app is out of date instead of showing a generic recover error whose retry
 * would re-create the same rejected request.
 */
function isRetiredSignInMethod(method: string): boolean {
  return method.toLowerCase() === RETIRED_SIGN_IN_METHOD
}

/**
 * Rejects any recovered request whose method is not on the {@link ALLOWED_METHODS} allowlist and
 * returns it in its canonical EIP-1193 spelling. This is the primary defense against dangerous
 * methods (e.g. `eth_sign`) reaching the wallet; forwarding arbitrary provider methods is never
 * safe on a signing surface.
 *
 * Matching stays case-insensitive so a client with a casing quirk isn't turned away, but the
 * canonical spelling is what callers must dispatch on. Dispatch downstream is case-SENSITIVE
 * (RequestPage switches on `eth_sendTransaction` exactly and forwards the method verbatim to the
 * wallet), so an oddly-cased method that only passed the gate would otherwise skip the whole
 * transaction path — classification, meta-transaction relay, gas estimate — and then dead-end at a
 * wallet that doesn't recognize it.
 */
function assertMethodIsAllowed(method: string): string {
  const canonicalMethod = CANONICAL_METHODS_BY_LOWERCASE.get(method.toLowerCase())
  if (!canonicalMethod) {
    throw new UnsupportedMethodError(method)
  }
  return canonicalMethod
}

// A Decentraland identity-authorization message (built by @dcl/crypto's
// `Authenticator.getEphemeralMessage`) looks like:
//
//   Decentraland Login
//   Ephemeral address: 0x<address>
//   Expiration: <ISO timestamp>
//
// When validating an auth chain, @dcl/crypto's `parseEmphemeralPayload` strips `\r`,
// splits on `\n`, and only reads the 2nd line (ephemeral address) and 3rd line
// (expiration) — the first "human readable" line is ignored. A forged message can
// therefore use any header and still yield a usable ephemeral auth chain.
//
// Crucially, `parseEmphemeralPayload` extracts the ephemeral address and expiration by FIXED offsets —
// `line.substring('Ephemeral address: '.length)` and `line.substring('Expiration: '.length)` — and
// never checks those prefixes. Matching the literal prefixes here would be STRICTER than the
// consumer: a forged message that keeps the offsets but changes the prefixes would evade this guard
// yet still parse into a usable ephemeral auth chain. So detect on the same offsets the consumer
// reads, not on the prefixes.
const EPHEMERAL_ADDRESS_LINE_OFFSET = 'Ephemeral address: '.length
const EXPIRATION_LINE_OFFSET = 'Expiration: '.length

/**
 * Returns whether a message would parse as a Decentraland identity-authorization payload the way
 * @dcl/crypto reads it: three or more lines, with the 2nd carrying an ephemeral address at the
 * offset the consumer slices from and the 3rd a parseable expiration at its offset. The literal
 * "Ephemeral address:" / "Expiration:" prefixes are deliberately NOT required — the consumer
 * ignores them, so requiring them would let a re-prefixed forgery through.
 */
function isDecentralandIdentityAuthMessage(message: unknown): boolean {
  if (typeof message !== 'string') {
    return false
  }

  const lines = message.replace(/\r/g, '').split('\n')
  if (lines.length < 3) {
    return false
  }

  // The exact bytes parseEmphemeralPayload would take as the ephemeral address and expiration.
  const ephemeralAddress = lines[1].slice(EPHEMERAL_ADDRESS_LINE_OFFSET)
  const expiration = Date.parse(lines[2].slice(EXPIRATION_LINE_OFFSET))
  return ADDRESS_REGEX.test(ephemeralAddress) && !Number.isNaN(expiration)
}

// `personal_sign` params are routinely hex-encoded UTF-8 rather than plaintext — the approval UI
// decodes them the same way (see classifyRequest). The wallet signs the DECODED bytes, so a
// hex-wrapped identity payload produces exactly the same usable auth chain as a plaintext one.
// Detection therefore has to look through the encoding instead of only at the literal param.
// Deliberately broader than the shared `isHexBytes` (which is strict on a lowercase `0x`, because that
// is what wallets sign as bytes): this check must fail closed, so a `0X…` payload some wallet might
// still decode is looked through as well. The two patterns differ on purpose.
const HEX_STRING_REGEX = /^0x([0-9a-fA-F]{2})+$/i

function decodeHexUtf8(value: string): string | null {
  if (!HEX_STRING_REGEX.test(value)) {
    return null
  }
  try {
    // Normalize a `0X` prefix, which hexToString does not accept.
    return hexToString(`0x${value.slice(2)}`)
  } catch {
    return null
  }
}

/**
 * Returns whether a single request param carries a Decentraland identity-authorization payload,
 * either as plaintext or as hex-encoded UTF-8.
 */
function isIdentityAuthParam(param: unknown): boolean {
  if (isDecentralandIdentityAuthMessage(param)) {
    return true
  }
  if (typeof param !== 'string') {
    return false
  }
  const decoded = decodeHexUtf8(param)
  return decoded !== null && isDecentralandIdentityAuthMessage(decoded)
}

/**
 * Guards a recovered request against sign-in impersonation. No method may sign a
 * Decentraland identity-authorization payload: doing so would grant the requester an auth
 * chain that impersonates the user. There is no exemption — the sign-in flow that used to
 * need one now hands the identity over through `POST /identities` instead of a signature.
 */
function assertRequestIsNotImpersonatingSignIn(method: string, params: unknown[] | undefined): void {
  if (params?.some(isIdentityAuthParam)) {
    throw new ImpersonatedSignInError(method)
  }
}

// Methods whose params the wallet and the review both read by position; see assertSignatureParamsAreCanonical.
const POSITIONAL_SIGNATURE_METHODS = new Set(['personal_sign', 'eth_signtypeddata_v3', 'eth_signtypeddata_v4'])

function isSigner(param: unknown, signer: string): boolean {
  return typeof param === 'string' && param.toLowerCase() === signer
}

function parseTypedData(param: unknown): unknown {
  if (typeof param !== 'string') {
    return param
  }
  try {
    return JSON.parse(param)
  } catch {
    return null
  }
}

function hasPrimaryType(typedData: unknown): boolean {
  return typeof typedData === 'object' && typedData !== null && typeof (typedData as { primaryType?: unknown }).primaryType === 'string'
}

// EIP-712 carries integers only, and a JSON number becomes a JavaScript double when the typed data is parsed
// and serialized for the wallet. An integer literal the double cannot hold exactly is rewritten on the way
// (9007199254740993 becomes 9007199254740992, a collection item id loses its low digits), so the wallet would
// sign a value other than the one the request said. Such a request is refused: a value that large belongs in
// a string, which is what every EIP-712 encoder emits for it. Integers the double does hold exactly, such as
// 10^18 or 10^20 wei, keep their value whatever digits the serializer prints, and pass. A fraction or an
// exponent is refused too: neither is an EIP-712 integer.
const JSON_NUMBER_LEXEME = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const INTEGER_LEXEME = /^-?(?:0|[1-9]\d*)$/

/** Whether `lexeme` is an integer literal whose value a JavaScript number holds exactly. */
function isExactInteger(lexeme: string): boolean {
  if (!INTEGER_LEXEME.test(lexeme)) return false
  const value = Number(lexeme)
  return Number.isFinite(value) && BigInt(lexeme) === BigInt(value)
}

/**
 * Whether every number literal in `json` keeps its value through a parse and a serialization. Strings are
 * skipped (with their escapes), so a numeric-looking value inside quotes is not a number.
 */
function hasOnlyExactNumbers(json: string): boolean {
  let inString = false
  for (let index = 0; index < json.length; index++) {
    const char = json[index]
    if (inString) {
      if (char === '\\') index++
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '-' || (char >= '0' && char <= '9')) {
      JSON_NUMBER_LEXEME.lastIndex = index
      const match = JSON_NUMBER_LEXEME.exec(json)
      if (!match) return false
      const lexeme = match[0]
      if (!isExactInteger(lexeme)) return false
      index += lexeme.length - 1
    }
  }
  return true
}

// A byte cap alone does not bound JSON indentation or serializer recursion. Check depth before any
// stringify: a small request can contain thousands of nested arrays and expand dramatically in the view.
const MAX_TYPED_DATA_DEPTH = 64

function hasExcessiveTypedDataDepth(value: unknown, depth = 0): boolean {
  if (value === null || typeof value !== 'object') return false
  if (depth >= MAX_TYPED_DATA_DEPTH) return true
  return Object.values(value).some(child => hasExcessiveTypedDataDepth(child, depth + 1))
}

/**
 * Rejects signature params that are not in the canonical EIP-1193 order for their method.
 * Typed data must be `[signer, typedData]`; personal_sign must be `[message, signer]`.
 * The shape of the typed data itself is not judged here. Whether it is a Decentraland
 * MetaTransaction the page can decode, or anything else, is decided by the request classifier:
 * a MetaTransaction that deviates from what a Decentraland contract signs is rejected there when
 * it names a Decentraland contract, and shown as an unverified signature when it names one
 * Decentraland does not recognize, since nothing is decoded for it that could diverge.
 */
function assertSignatureParamsAreCanonical(method: string, params: unknown[] | undefined, signerAddress: string): void {
  const normalizedMethod = method.toLowerCase()
  if (!POSITIONAL_SIGNATURE_METHODS.has(normalizedMethod)) {
    return
  }
  if (!Array.isArray(params) || params.length !== 2) {
    throw new MalformedSignatureRequestError(method)
  }

  const signer = signerAddress.toLowerCase()
  const [first, second] = params
  if (normalizedMethod === 'personal_sign') {
    // Wallets sign the first param, so the message must come first and the signer second.
    if (typeof first !== 'string' || typeof second !== 'string' || isSigner(first, signer) || !isSigner(second, signer)) {
      throw new MalformedSignatureRequestError(method)
    }
    if (first.length > MAX_SIGNATURE_PAYLOAD_CHARS) {
      throw new MalformedSignatureRequestError(method, 'the message is too large to review')
    }
    return
  }

  // Refuse oversized strings before parsing them; object payloads are measured after the depth check
  // so JSON.stringify cannot overflow its stack while trying to apply the size limit.
  if (typeof second === 'string' && second.length > MAX_SIGNATURE_PAYLOAD_CHARS) {
    throw new MalformedSignatureRequestError(method, 'the typed data is too large to review')
  }
  const typedData = parseTypedData(second)
  if (!isSigner(first, signer) || !hasPrimaryType(typedData)) {
    throw new MalformedSignatureRequestError(method)
  }
  // Text that parsed as typed data is scanned as text: the wallet is handed a serialization of the parsed
  // value, so a literal the parse rewrote would be signed as something else. A parsed object has no literals
  // left to rewrite, since a number value serializes to itself.
  if (typeof second === 'string' && !hasOnlyExactNumbers(second)) {
    throw new MalformedSignatureRequestError(method, 'the typed data contains a number that cannot be represented exactly')
  }
  if (hasExcessiveTypedDataDepth(typedData)) {
    throw new MalformedSignatureRequestError(method, 'the typed data is too deeply nested to review')
  }
  const serializedLength = typeof second === 'string' ? second.length : JSON.stringify(second).length
  if (serializedLength > MAX_SIGNATURE_PAYLOAD_CHARS) {
    throw new MalformedSignatureRequestError(method, 'the typed data is too large to review')
  }
}

// Fields other than `data` that carry calldata. viem forwards them and thirdweb concatenates
// `extraCallData` onto `data`, so a request using them would execute bytes the review never read.
const CALLDATA_ALIASES = ['input', 'extraCallData']
// A transaction's `data` field: hex-encoded whole bytes, possibly none (a plain value transfer sends
// `0x`). Not the shared CALLDATA_REGEX of the contract decoder, which requires a 4-byte selector: that
// one judges a call, this one judges a field, and a transfer has no call.
const TRANSACTION_DATA_REGEX = /^0x([0-9a-fA-F]{2})*$/
// A JSON-RPC quantity: hex, or the decimal form some clients send. Shared with the request page's
// toHexQuantity, which turns either form into the canonical hex the wallet and the review are handed,
// so the guard and the normalizer judge a quantity the same way.
const QUANTITY_REGEX = /^(0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$/
// Far above any legitimate Decentraland call, and small enough that decoding and displaying the calldata
// stays cheap: without a cap, oversized calldata is a deterministic way to stall the review.
const MAX_CALLDATA_BYTES = 96 * 1024
// The same bound for what a signature request asks to sign (a personal_sign message, or typed data as
// the string or object it arrives as). Legitimate payloads are far smaller; without a cap, the review
// would parse, pretty-print and fingerprint whatever a scene sends on every render.
const MAX_SIGNATURE_PAYLOAD_CHARS = 96 * 1024

/**
 * Rejects eth_sendTransaction params that are not a single transaction object the review can read
 * and the wallet would execute as shown. Every rule here fails closed at recover time, so the request
 * is answered with invalid params instead of reaching a review that a later click would still execute.
 */
function assertTransactionParamsAreCanonical(method: string, params: unknown[] | undefined): void {
  if (method.toLowerCase() !== 'eth_sendtransaction') {
    return
  }
  const reject = (reason: string): never => {
    throw new MalformedTransactionRequestError(method, reason)
  }
  if (!Array.isArray(params) || params.length !== 1) {
    return reject('expected exactly one transaction object')
  }
  const transaction: unknown = params[0]
  if (typeof transaction !== 'object' || transaction === null || Array.isArray(transaction)) {
    return reject('the transaction must be an object')
  }
  const fields = transaction as Record<string, unknown>
  const alias = CALLDATA_ALIASES.find(key => fields[key] !== undefined)
  if (alias) {
    return reject(`calldata must be provided in "data", not "${alias}"`)
  }
  if (typeof fields.to !== 'string' || !ADDRESS_REGEX.test(fields.to)) {
    return reject('"to" must be an address')
  }
  if (fields.data !== undefined) {
    if (typeof fields.data !== 'string' || !TRANSACTION_DATA_REGEX.test(fields.data)) {
      return reject('"data" must be hex-encoded bytes')
    }
    if ((fields.data.length - 2) / 2 > MAX_CALLDATA_BYTES) {
      return reject('"data" is too large to review')
    }
  }
  if (fields.value !== undefined && (typeof fields.value !== 'string' || !QUANTITY_REGEX.test(fields.value))) {
    return reject('"value" must be a hex or decimal quantity')
  }
}

export {
  CALLDATA_ALIASES,
  QUANTITY_REGEX,
  assertTransactionParamsAreCanonical,
  isDecentralandIdentityAuthMessage,
  assertRequestIsNotImpersonatingSignIn,
  assertMethodIsAllowed,
  assertSignatureParamsAreCanonical,
  isRetiredSignInMethod
}
