import { ImpersonatedSignInError } from './errors'

// The Decentraland-specific signing method used by the sign-in flow. It is the only
// method allowed to produce a signature over an identity-authorization payload.
const DCL_SIGN_IN_METHOD = 'dcl_personal_sign'

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
 * Returns whether a message replicates the Decentraland identity-authorization payload
 * that the `dcl_personal_sign` sign-in flow asks the user to sign. Detection mirrors how
 * @dcl/crypto validates the payload so that any message which would yield a usable auth
 * chain is caught, regardless of its first line.
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

export { DCL_SIGN_IN_METHOD, isDecentralandIdentityAuthMessage, assertRequestIsNotImpersonatingSignIn }
