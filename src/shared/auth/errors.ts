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
  constructor(
    public readonly requestId: string,
    public readonly reason: string
  ) {
    super(`IP validation failed: ${reason}`)
    this.name = 'IpValidationError'
  }
}

class TimedOutError extends Error {
  constructor() {
    super('The signing operation timed out')
    this.name = 'TimedOutError'
  }
}

/**
 * Thrown when a request whose method is not `dcl_personal_sign` (e.g. a plain
 * `personal_sign`) asks the user to sign a Decentraland identity-authorization
 * payload. Allowing it would let a malicious site replicate the `dcl_personal_sign`
 * sign-in flow through the generic signing path, bypassing its protections, and
 * obtain a valid auth chain that impersonates the user.
 */
class ImpersonatedSignInError extends Error {
  constructor(public readonly method: string) {
    super(`The "${method}" method cannot be used to sign a Decentraland sign-in payload`)
    this.name = 'ImpersonatedSignInError'
  }
}

export {
  DifferentSenderError,
  ExpiredRequestError,
  RequestNotFoundError,
  RequestFulfilledError,
  IpValidationError,
  TimedOutError,
  ImpersonatedSignInError
}
