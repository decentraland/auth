function isErrorWithMessage(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'message' in error
}

function isErrorWithName(error: unknown): error is Error {
  return error !== undefined && error !== null && typeof error === 'object' && 'name' in error
}

/**
 * Thrown when the connected wallet cannot be asked to sign the login message.
 *
 * WalletConnect only relays the methods the wallet approved for the session; anything else is
 * answered by a public RPC node that cannot sign, so the request never reaches the wallet and no
 * confirmation prompt is ever shown. Detecting it up front keeps the user from retrying a
 * connection that can never succeed.
 */
class WalletSignatureUnsupportedError extends Error {
  constructor() {
    super('The connected wallet did not approve the signing method required to log in')
    this.name = 'WalletSignatureUnsupportedError'
  }
}

function isWalletSignatureUnsupportedError(error: unknown): error is WalletSignatureUnsupportedError {
  return isErrorWithName(error) && error.name === 'WalletSignatureUnsupportedError'
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

/**
 * Wallet-side conditions that stay out of Sentry but, unlike {@link isExpectedWalletError}, keep
 * their message on the login screen. The login screen blanks the error detail for expected wallet
 * errors, and for these the wallet's own message is what tells the user what to do:
 *
 * - EIP-1193 `4100` (Unauthorized) with "DApp interaction is disabled": the user switched dApp
 *   access off in the wallet.
 * - `-32001` with "Already processing unlock. Please wait.": the wallet is still busy unlocking.
 *
 * Both match on the code and the exact message. Other `4100` refusals (an account or method the
 * user never authorized) can point at our own requests, and other `-32001` failures are not this
 * state, so they keep reporting.
 */
function isUnreportedWalletCondition(error: unknown): boolean {
  if (!isErrorWithMessage(error)) return false

  // A raw provider error carries the wallet's text in `message`. viem (the signing path) wraps it
  // in its own error with a generic `message`, keeping the code and moving the wallet's text to
  // `details`.
  const { code, details } = error as { code?: unknown; details?: unknown }
  const says = (text: string) => error.message === text || details === text

  if (code === 4100 && says('DApp interaction is disabled')) return true
  if (code === -32001 && says('Already processing unlock. Please wait.')) return true

  return false
}

/**
 * What each browser's `fetch` rejects with when the request never gets a response (offline, a
 * blocking extension, a network that blocks the host): Chromium, Safari and Firefox respectively.
 */
const BROWSER_NETWORK_FAILURE_MESSAGES = new Set(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])

/**
 * Detects Magic SDK failing to reach Magic's own API. The request runs inside the Magic iframe; when
 * the browser's fetch fails there, the iframe answers with JSON-RPC internal error -32603 carrying the
 * browser's network-failure text, which the SDK surfaces as `Magic RPC Error: [-32603] Failed to fetch`.
 * The login genuinely fails for the user, but the cause is their connection to Magic, not our code.
 *
 * Only that exact shape matches: any other -32603 from Magic is a real failure and keeps reporting.
 */
function isMagicNetworkError(error: unknown): boolean {
  return isMagicRpcError(error) && error.code === -32603 && BROWSER_NETWORK_FAILURE_MESSAGES.has(error.rawMessage)
}

/**
 * Detects thirdweb refusing the address the user typed for an email login. thirdweb's server is
 * stricter than our own `isEmailValid` check (it refuses, for example, a one-character TLD), and
 * `preAuthenticate` rethrows the server's message as is. The login page already shows this as the
 * translated invalid-email error. It is a typo in user input, not a fault of ours.
 *
 * Only that message matches (ignoring case, surrounding spaces and the trailing period), so any other
 * thirdweb failure keeps reporting.
 */
function isThirdwebInvalidEmailError(error: unknown): boolean {
  return isErrorWithMessage(error) && typeof error.message === 'string' && /^invalid email\.?$/i.test(error.message.trim())
}

/**
 * Detects a wallet refusing an eth_sendTransaction because the request's `chainId` does not match its
 * active network: EIP-1474 invalid params, code -32602, with a message that names the chain. viem
 * wraps provider errors, so the code and message may sit on the error itself, on its `cause`, or on a
 * nested `error` object. Such a refusal is not the user's decision: the request stays unanswered and
 * is reviewed again on the live network.
 */
function isChainMismatchRejection(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error
  for (let depth = 0; depth < 4 && current !== null && typeof current === 'object' && !seen.has(current); depth++) {
    seen.add(current)
    const record = current as {
      code?: unknown
      message?: unknown
      details?: unknown
      shortMessage?: unknown
      cause?: unknown
      error?: unknown
    }
    const text = [record.message, record.details, record.shortMessage]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
    if (record.code === -32602 && /chain/i.test(text)) {
      return true
    }
    current = record.cause ?? record.error
  }
  return false
}

export type { RPCError }
export {
  WalletSignatureUnsupportedError,
  isErrorWithMessage,
  isErrorWithName,
  isRpcError,
  isMagicRpcError,
  isMagicExtensionError,
  isMagicNetworkError,
  isThirdwebInvalidEmailError,
  isUserRejectedTransaction,
  isWalletSignatureUnsupportedError,
  isExpectedWalletError,
  isUnreportedWalletCondition,
  isChainMismatchRejection
}
