type RecoverResponse = {
  sender: string
  expiration: string
  method: string
  error?: string
  params?: unknown[]
}

type OutcomeResponse = {
  error?: string
}

type IdentityResponse = {
  identityId: string
  expiration: Date
}

type OutcomeError = { code: number; message: string }

export type { RecoverResponse, OutcomeResponse, IdentityResponse, OutcomeError }
