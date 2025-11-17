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
  token?: string
  deepLink?: string
}

export type TokenResponse = {
  token: string
  deepLink: string
}

export type OutcomeError = { code: number; message: string }

export type ValidationResponse = {
  error?: string
}
