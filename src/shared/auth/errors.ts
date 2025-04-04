export class DifferentSenderError extends Error {
  constructor(public readonly address: string, public readonly sender: string) {
    super(`The sender ${address} is different from the sender ${sender}`)
  }
}

export class ExpiredRequestError extends Error {
  constructor(public readonly requestId: string, public readonly expiration?: string) {
    super(`The request ${requestId} has expired${expiration ? ` at ${expiration}` : ''}`)
  }
}

export class RequestNotFoundError extends Error {
  constructor(public readonly requestId: string) {
    super(`The request ${requestId} was not found`)
  }
}
