class DifferentSenderError extends Error {
  constructor(
    public readonly address: string,
    public readonly sender: string
  ) {
    super(`The sender ${address} is different from the sender ${sender}`)
  }
}

class ExpiredRequestError extends Error {
  constructor(
    public readonly requestId: string,
    public readonly expiration?: string
  ) {
    super(`The request ${requestId} has expired${expiration ? ` at ${expiration}` : ''}`)
  }
}

class RequestNotFoundError extends Error {
  constructor(public readonly requestId: string) {
    super(`The request ${requestId} was not found`)
  }
}

class RequestFulfilledError extends Error {
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

export { DifferentSenderError, ExpiredRequestError, RequestNotFoundError, RequestFulfilledError, IpValidationError, TimedOutError }
