export type RecoverResponse = {
  sender: string
  expiration: string
  method: string
  code?: string
  error?: string
  params?: any[]
}

export type OutcomeResponse = {
  error?: string
}

export type OutcomeError = { code: number; message: string }
