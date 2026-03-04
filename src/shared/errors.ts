function isErrorWithMessage(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'message' in error
}

function isErrorWithName(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'name' in error
}

type RPCError = {
  error: {
    code: number
    message: string
    data?: unknown
  }
}

function isRpcError(error: unknown): error is RPCError {
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

/**
 * Duck-typing guard for Magic SDK's RPCError.
 * Avoids importing magic-sdk at runtime just for instanceof checks.
 */
function isMagicRpcError(error: unknown): error is { code: number; rawMessage: string; data: unknown } {
  return error !== null && typeof error === 'object' && 'code' in error && 'rawMessage' in error
}

export type { RPCError }
export { isErrorWithMessage, isErrorWithName, isRpcError, isMagicRpcError }
