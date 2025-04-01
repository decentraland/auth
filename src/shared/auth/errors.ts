export class DifferentSenderError extends Error {
  constructor(public readonly address: string, public readonly sender: string) {
    super(`The sender ${address} is different from the sender ${sender}`)
  }
}

export class ExpiredRequestError extends Error {
  constructor(public readonly requestId: string, public readonly expiration: string) {
    super(`The request ${requestId} has expired at ${expiration}`)
  }
}

export class OutcomeError extends Error {
  constructor(error: string) {
    super(error)
  }
}
