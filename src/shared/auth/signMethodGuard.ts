import { hexToString } from 'viem'
import { ImpersonatedSignInError, UnsupportedMethodError } from './errors'

// The Decentraland-specific signing method used by the sign-in flow. It is the only
// method allowed to produce a signature over an identity-authorization payload.
const DCL_SIGN_IN_METHOD = 'dcl_personal_sign'

// The only methods the auth site is willing to forward to the connected wallet. Anything
// outside this set is rejected at recover time (see {@link assertMethodIsAllowed}).
//
// `eth_sign` is deliberately excluded: unlike `personal_sign`, it signs a raw 32-byte digest
// with no EIP-191 (`\x19Ethereum Signed Message:\n`) prefix. That lets a request blind-sign an
// arbitrary hash — including a transaction hash, or the pre-computed digest of a Decentraland
// sign-in message. The latter would bypass `assertRequestIsNotImpersonatingSignIn`, which can
// only recognize a *plaintext* sign-in payload, not its hash. Major wallets deprecated
// `eth_sign` for the same reason.
const ALLOWED_METHODS = new Set([
  'dcl_personal_sign',
  'personal_sign',
  'eth_signtypeddata',
  'eth_signtypeddata_v3',
  'eth_signtypeddata_v4',
  'eth_sendtransaction'
])

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

// A hex-encoded byte string, the form personal_sign messages take on the wire (e.g. MetaMask
// encodes the UTF-8 message as hex). Only even-length all-hex `0x…` values qualify.
const HEX_STRING_REGEX = /^0x([0-9a-fA-F]{2})*$/

/**
 * Returns whether a message replicates the Decentraland identity-authorization payload
 * that the `dcl_personal_sign` sign-in flow asks the user to sign. Detection mirrors how
 * @dcl/crypto validates the payload so that any message which would yield a usable auth
 * chain is caught, regardless of its first line.
 */
function isDecentralandIdentityAuthMessage(message: unknown): boolean {
  if (typeof message !== 'string') {
    return false
  }

  // personal_sign carries its message hex-encoded and the wallet decodes it to UTF-8 before
  // signing, so a hex-wrapped sign-in payload would still yield a usable auth chain. Decode it
  // here too (mirroring extractSignaturePayload) so the structural check below can't be bypassed
  // by hex-encoding. A non-hex message is checked as-is; invalid hex falls back to the raw value.
  let decoded = message
  if (HEX_STRING_REGEX.test(message) && message.length > 2) {
    try {
      decoded = hexToString(message as `0x${string}`)
    } catch {
      decoded = message
    }
  }

  const lines = decoded.replace(/\r/g, '').split('\n')
  if (lines.length < 3) {
    return false
  }

  return lines[1].startsWith(EPHEMERAL_ADDRESS_LINE_PREFIX) && lines[2].startsWith(EXPIRATION_LINE_PREFIX)
}

/**
 * Guards a recovered request against sign-in impersonation. Any method other than
 * `dcl_personal_sign` that carries a Decentraland identity-authorization payload in its
 * params is rejected with an {@link ImpersonatedSignInError}, since signing it would
 * grant the requester an auth chain that impersonates the user.
 */
function assertRequestIsNotImpersonatingSignIn(method: string, params: unknown[] | undefined): void {
  if (method === DCL_SIGN_IN_METHOD) {
    return
  }

  if (params?.some(isDecentralandIdentityAuthMessage)) {
    throw new ImpersonatedSignInError(method)
  }
}

export { DCL_SIGN_IN_METHOD, isDecentralandIdentityAuthMessage, assertRequestIsNotImpersonatingSignIn, assertMethodIsAllowed }
