import { hexToString } from 'viem'
import { ImpersonatedSignInError, MalformedSignatureRequestError, UnsupportedMethodError } from './errors'
import { isMetaTransactionTypedData, resolveMetaTransactionTypedData } from './metaTransactionTypedData'

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
 * transaction path — simulation, meta-transaction relay, gas estimate — and then dead-end at a
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
// therefore use any header and still yield a usable ephemeral auth chain, so we match
// that same structure rather than the literal "Decentraland Login" header.
const EPHEMERAL_ADDRESS_LINE_PREFIX = 'Ephemeral address: 0x'
const EXPIRATION_LINE_PREFIX = 'Expiration: '

/**
 * Returns whether a message replicates the Decentraland identity-authorization payload.
 * Detection mirrors how @dcl/crypto validates the payload so that any message which would
 * yield a usable auth chain is caught, regardless of its first line.
 */
function isDecentralandIdentityAuthMessage(message: unknown): boolean {
  if (typeof message !== 'string') {
    return false
  }

  const lines = message.replace(/\r/g, '').split('\n')
  if (lines.length < 3) {
    return false
  }

  return lines[1].startsWith(EPHEMERAL_ADDRESS_LINE_PREFIX) && lines[2].startsWith(EXPIRATION_LINE_PREFIX)
}

// `personal_sign` params are routinely hex-encoded UTF-8 rather than plaintext — the approval UI
// decodes them the same way (see extractSignaturePayload). The wallet signs the DECODED bytes, so a
// hex-wrapped identity payload produces exactly the same usable auth chain as a plaintext one.
// Detection therefore has to look through the encoding instead of only at the literal param.
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

// Methods whose params the wallet and the preview both read by position; see assertSignatureParamsAreCanonical.
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

/**
 * Rejects signature params that are not in the canonical EIP-1193 order for their method.
 * Typed data must be `[signer, typedData]`; personal_sign must be `[message, signer]`.
 *
 * A typed-data MetaTransaction is additionally held to the exact struct, message and domain a
 * Decentraland contract signs (see {@link resolveMetaTransactionTypedData}): its preview simulates
 * the inner call, and EIP-712 signs only the fields the struct declares, so a looser shape could
 * simulate one call while the signature covers another.
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
    return
  }

  const typedData = parseTypedData(second)
  if (!isSigner(first, signer) || !hasPrimaryType(typedData)) {
    throw new MalformedSignatureRequestError(method)
  }
  if (isMetaTransactionTypedData(typedData)) {
    // Validation only: the request page resolves the call again when it simulates.
    resolveMetaTransactionTypedData(typedData, method)
  }
}

export {
  isDecentralandIdentityAuthMessage,
  assertRequestIsNotImpersonatingSignIn,
  assertMethodIsAllowed,
  assertSignatureParamsAreCanonical,
  isRetiredSignInMethod
}
