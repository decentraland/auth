import { ImpersonatedSignInError, UnsupportedMethodError } from './errors'

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
const ALLOWED_METHODS = new Set([
  'personal_sign',
  'eth_signtypeddata',
  'eth_signtypeddata_v3',
  'eth_signtypeddata_v4',
  'eth_sendtransaction'
])

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
 * Rejects any recovered request whose method is not on the {@link ALLOWED_METHODS} allowlist.
 * This is the primary defense against dangerous methods (e.g. `eth_sign`) reaching the wallet;
 * forwarding arbitrary provider methods is never safe on a signing surface.
 */
function assertMethodIsAllowed(method: string): void {
  if (!ALLOWED_METHODS.has(method.toLowerCase())) {
    throw new UnsupportedMethodError(method)
  }
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

/**
 * Guards a recovered request against sign-in impersonation. No method may sign a
 * Decentraland identity-authorization payload: doing so would grant the requester an auth
 * chain that impersonates the user. There is no exemption — the sign-in flow that used to
 * need one now hands the identity over through `POST /identities` instead of a signature.
 */
function assertRequestIsNotImpersonatingSignIn(method: string, params: unknown[] | undefined): void {
  if (params?.some(isDecentralandIdentityAuthMessage)) {
    throw new ImpersonatedSignInError(method)
  }
}

export { isDecentralandIdentityAuthMessage, assertRequestIsNotImpersonatingSignIn, assertMethodIsAllowed, isRetiredSignInMethod }
