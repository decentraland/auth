/**
 * Thrown when an error is caused by user input rather than a system failure.
 * These are intentionally excluded from Sentry to avoid noise.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

export function isErrorWithMessage(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'message' in error
}

export function isErrorWithName(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'name' in error
}

export type RPCError = {
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export function isRpcError(error: unknown): error is RPCError {
  return (
    error !== undefined &&
    error !== null &&
    typeof error === 'object' &&
    'error' in error &&
    error.error !== undefined &&
    error.error !== null &&
    typeof error.error === 'object' &&
    'message' in error.error &&
    'code' in error.error
  )
}
