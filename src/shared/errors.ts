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
 * - @web3-react/injected-connector's UserRejectedRequestError (no code at all)
 *    Thrown by connection.connect() during login, reached through decentraland-connect.
 *    Matched by message ("The user rejected the request.") since it exposes nothing else.
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

  // @web3-react/injected-connector throws its own UserRejectedRequestError from
  // connection.connect(), which reaches us through decentraland-connect's ConnectionManager.
  // It carries no EIP-1193 code at all, and its name comes from `this.constructor.name`, which
  // minification rewrites to a single letter in production — leaving the message as the only
  // stable signal. Note the wording differs from viem's by a leading article.
  if (isErrorWithMessage(error) && error.message === 'The user rejected the request.') return true

  return false
}

/**
 * Wallet and connector conditions that are not application faults: the wallet is locked, it
 * already has a prompt open for this origin, or the user dismissed the connection modal. The
 * login genuinely fails for the user — so these are still logged and tracked — but there is
 * nothing here for us to fix.
 *
 * User rejections are detected separately by {@link isUserRejectedTransaction}, which some call
 * sites also use to drive navigation and so must stay distinguishable.
 */
function isExpectedWalletError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false

  // decentraland-connect's InjectedConnector rejects with this when the injected wallet will not
  // unlock. The login screen already keys its ERROR_LOCKED_WALLET state off the same name.
  if (isErrorWithName(error) && error.name === 'ErrorUnlockingWallet') return true

  // EIP-1193 "resource unavailable". MetaMask uses it for "a request of this type is already
  // pending for this origin", which clears as soon as the user answers the prompt already open.
  if ((error as { code: unknown }).code === -32002) return true

  // decentraland-connect's WalletConnectV2Connector rejects with a bare Error when the user closes
  // the AppKit modal, so the message is the only signal it leaves.
  if (isErrorWithMessage(error) && error.message === 'User closed the modal without connecting') return true

  return false
}

export type { RPCError }
export {
  isErrorWithMessage,
  isErrorWithName,
  isRpcError,
  isMagicRpcError,
  isMagicExtensionError,
  isUserRejectedTransaction,
  isExpectedWalletError
}
