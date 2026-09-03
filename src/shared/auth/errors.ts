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
 * Thrown when a signature request's params are not in the canonical EIP-1193 shape for the method,
 * or when a MetaTransaction payload is not shaped the way a Decentraland contract signs it. The
 * preview and the wallet read params by position, and EIP-712 signs only the fields the struct
 * declares, so any other shape could show one payload and sign another. `reason` says which rule
 * was broken; it is safe to display.
 */
class MalformedSignatureRequestError extends Error {
  constructor(
    public readonly method: string,
    public readonly reason?: string
  ) {
    super(`The "${method}" request parameters are malformed${reason ? `: ${reason}` : ''}`)
    this.name = 'MalformedSignatureRequestError'
  }
}

/**
 * Thrown when the transaction-simulation endpoint is unreachable, times out, or
 * returns a non-200 response. The approval UI treats this as "details unavailable"
 * and falls back to the default confirmation — simulation is never allowed to block
 * or fail an approval. `status` carries the HTTP status when there was a response, so a
 * caller can tell the server rejecting the call itself (400) from an outage.
 */
class SimulationUnavailableError extends Error {
  readonly skipReporting = true
  constructor(
    reason?: string,
    public readonly status?: number
  ) {
    super(`Transaction simulation unavailable${reason ? `: ${reason}` : ''}`)
    this.name = 'SimulationUnavailableError'
  }
}

export {
  DifferentSenderError,
  ExpiredRequestError,
  RequestNotFoundError,
  RequestFulfilledError,
  ImpersonatedSignInError,
  UnsupportedMethodError,
  MalformedSignatureRequestError,
  SimulationUnavailableError
}
