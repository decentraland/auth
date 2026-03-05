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

/**
 * Duck-typing guard for Magic SDK's MagicExtensionError.
 * These have string error codes (e.g. 'MISSING_PKCE_METADATA', 'STATE_MISMATCH')
 * unlike MagicRPCError which uses numeric codes.
 */
function isMagicExtensionError(error: unknown): error is { code: string; rawMessage: string; data: unknown } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'rawMessage' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

 /**
 * Detects errors caused by the user rejecting a transaction or signature in their wallet.
 * These are expected user actions, not application errors.
 *
 * Covers:
 * - viem's UserRejectedRequestError (code 4001, EIP-1193 standard)
 *    Thrown by walletClient.signMessage() and walletClient.request()
 * - ethers v6 ACTION_REJECTED (code 'ACTION_REJECTED')
 *    Thrown when decentraland-connect returns an ethers BrowserProvider that
 *    intercepts the raw 4001 before viem can wrap it.
 * - decentraland-transactions' MetaTransactionError (code 'user_denied')
 *    Thrown by sendMetaTransaction() — but only when the wallet error message
 *    is exactly "User denied message signature". Viem uses a different message
 *    ("User rejected the request.") so the library falls through to code 'unknown',
 *    requiring a message-based fallback.
 */
function isUserRejectedTransaction(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false

  const code = (error as { code: unknown }).code
  // viem UserRejectedRequestError (EIP-1193)
  if (code === 4001) return true
  // ethers v6 — wraps raw 4001 as ACTION_REJECTED before viem sees it
  if (code === 'ACTION_REJECTED') return true
  // decentraland-transactions MetaTransactionError with correct classification
  if (code === 'user_denied') return true

  // decentraland-transactions wraps viem's rejection as ErrorCode.UNKNOWN
  // because it only checks for "User denied message signature" (ethers-era message).
  // Detect via the preserved viem message.
  if (code === 'unknown' && isErrorWithMessage(error) && error.message === 'User rejected the request.') return true

  return false
}

export type { RPCError }
export { isErrorWithMessage, isErrorWithName, isRpcError, isMagicRpcError, isMagicExtensionError, isUserRejectedTransaction }
