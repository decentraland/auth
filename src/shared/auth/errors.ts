class DifferentSenderError extends Error {
  constructor(
    public readonly address: string,
    public readonly sender: string
  ) {
    super(`The sender ${address} is different from the sender ${sender}`)
  }
}

class ExpiredRequestError extends Error {
  readonly skipReporting = true
  constructor(
    public readonly requestId: string,
    public readonly expiration?: string
  ) {
    super(`The request ${requestId} has expired${expiration ? ` at ${expiration}` : ''}`)
  }
}

class RequestNotFoundError extends Error {
  readonly skipReporting = true
  constructor(public readonly requestId: string) {
    super(`The request ${requestId} was not found`)
  }
}

class RequestFulfilledError extends Error {
  readonly skipReporting = true
  constructor(public readonly requestId: string) {
    super(`The request ${requestId} has already been fulfilled`)
  }
}

class IpValidationError extends Error {
  public readonly reason: string
  constructor(
    public readonly requestId: string,
    reason: string
  ) {
    // Callers pass the raw server error, which already starts with "IP validation failed:" (that
    // is how the branch detects it). Strip any leading occurrence before composing the message so
    // the user isn't shown a doubled "IP validation failed: IP validation failed: ..." prefix.
    const cleanReason = reason.replace(/^IP validation failed:?\s*/i, '')
    super(cleanReason ? `IP validation failed: ${cleanReason}` : 'IP validation failed')
    this.name = 'IpValidationError'
    this.reason = cleanReason
  }
}

class TimedOutError extends Error {
  constructor() {
    super('The signing operation timed out')
    this.name = 'TimedOutError'
  }
}

/**
 * Thrown when a request asks the user to sign a Decentraland identity-authorization
 * payload through a generic signing method (e.g. `personal_sign`). Allowing it would
 * hand the requester a valid auth chain that impersonates the user. No method is
 * exempt: identities are issued through `POST /identities`, never through a signature
 * the auth site produces on a request's behalf.
 */
class ImpersonatedSignInError extends Error {
  constructor(public readonly method: string) {
    super(`The "${method}" method cannot be used to sign a Decentraland sign-in payload`)
    this.name = 'ImpersonatedSignInError'
  }
}

/**
 * Thrown when a recovered request uses a signing/transaction method the auth site does not
 * support. The method allowlist (see {@link assertMethodIsAllowed}) deliberately excludes
 * dangerous legacy methods such as `eth_sign`, which signs a raw digest with no EIP-191 prefix
 * and could therefore be used to blind-sign a transaction hash or a pre-computed sign-in payload.
 */
class UnsupportedMethodError extends Error {
  constructor(public readonly method: string) {
    super(`The "${method}" method is not supported`)
    this.name = 'UnsupportedMethodError'
  }
}

/**
 * Thrown when the transaction-simulation endpoint is unreachable, times out, or
 * returns a non-200 response. The approval UI treats this as "details unavailable"
 * and falls back to the default confirmation — simulation is never allowed to block
 * or fail an approval.
 */
class SimulationUnavailableError extends Error {
  readonly skipReporting = true
  constructor(reason?: string) {
    super(`Transaction simulation unavailable${reason ? `: ${reason}` : ''}`)
    this.name = 'SimulationUnavailableError'
  }
}

export {
  DifferentSenderError,
  ExpiredRequestError,
  RequestNotFoundError,
  RequestFulfilledError,
  IpValidationError,
  TimedOutError,
  ImpersonatedSignInError,
  UnsupportedMethodError,
  SimulationUnavailableError
}
