type RecoverResponse = {
  sender: string
  expiration: string
  method: string
  code?: string
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

type ValidationResponse = {
  error?: string
}

export type { RecoverResponse, OutcomeResponse, IdentityResponse, OutcomeError, ValidationResponse }
