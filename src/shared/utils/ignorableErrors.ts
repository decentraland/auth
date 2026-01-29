/**
 * Utility to identify errors that are expected user behaviors or transient issues
 * and should not be reported to Sentry as they create noise.
 *
 * Categories:
 * - USER_INITIATED: User intentionally cancelled, closed, or rejected an action
 * - EXPECTED_STATE: Expected application states that aren't actual errors
 * - NETWORK_TRANSIENT: Transient network issues that are expected in production
 * - WALLET_SESSION: WalletConnect session issues that are common and expected
 */

// Error message patterns that indicate user-initiated cancellation
const USER_REJECTION_PATTERNS = [
  // User rejected signing in wallet
  /user rejected/i,
  /user denied/i,
  /user cancelled/i,
  /user canceled/i,
  /rejected the request/i,
  /action.rejected/i,
  // User closed wallet modal
  /closed the modal/i,
  /modal closed/i,
  // User rejected transaction
  /transaction was rejected/i,
  /denied transaction/i,
  // Additional user rejection patterns
  /ErrorUnlockingWallet/i,
  /user rejected methods/i,
  /^ha: the user rejected/i, // Minified Safari rejection
  /reject session/i
]

// Expected application state errors
const EXPECTED_STATE_PATTERNS = [
  // Request lifecycle states
  /request.*was not found/i,
  /request.*has expired/i,
  /request.*expired/i,
  /request expired/i,
  // Magic SDK expected states
  /magic.*user isn't logged in/i,
  /user is already logged in/i,
  /skipped remaining oauth/i,
  // OAuth flow states
  /missing required data in browser/i,
  /missing required params/i,
  /state parameter mismatch/i,
  /access_denied/i,
  /oauth verification/i,
  /authorizationResponseParams/i,
  // Expired signatures (clock sync issues - user should retry)
  /expired signature/i,
  /signature.*expired/i,
  // Additional expected state patterns
  /proposal expired/i,
  /already has a response/i,
  /contract accounts.*not supported/i, // Smart wallets
  /record was recently deleted/i,
  /the request is not recent enough/i, // Clock sync
  /the request is too far in the future/i // Clock sync
]

// Network transient issues
const NETWORK_TRANSIENT_PATTERNS = [
  /failed to fetch/i,
  /connection timeout/i,
  /network error/i,
  /networkerror/i,
  /timeout.*exceeded/i,
  /load failed/i,
  // Additional network patterns
  /connection request reset/i,
  /request timeout/i,
  /websocket connection failed/i,
  /publish interrupted/i,
  /websocket error/i,
  /subscribing to.*failed/i
]

// WalletConnect session issues
const WALLET_SESSION_PATTERNS = [/no matching key/i, /session topic doesn't exist/i, /session disconnected/i, /session expired/i]

// Browser/DOM errors that are transient or environment-specific
const BROWSER_ENVIRONMENT_PATTERNS = [
  // DOM manipulation race conditions
  /removeChild.*not a child/i,
  /node.*not found/i,
  // Clipboard permission errors
  /write.*permission denied/i,
  /clipboard.*denied/i,
  // IndexedDB/storage errors
  /the object can not be found here/i,
  // External mobile webview scripts that may not be available
  /MosTriggerCloseWebviewModal is not defined/i,
  // Gas price limits (business logic error shown to user, not a bug)
  /gas price.*exceeds/i,
  /exceeds max gas/i,
  // External library initialization race conditions (AppKit/WalletConnect)
  /setDefaultChain/i,
  /appkit.*not initialized/i
]

export type IgnorableErrorCategory = 'user_initiated' | 'expected_state' | 'network_transient' | 'wallet_session' | 'browser_environment'

export interface IgnorableErrorResult {
  isIgnorable: boolean
  category?: IgnorableErrorCategory
  reason?: string
}

/**
 * Check if an error message matches any of the given patterns
 */
const matchesPatterns = (message: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    if (pattern.test(message)) {
      return pattern.source
    }
  }
  return undefined
}

/**
 * Determines if an error should be ignored by Sentry based on its message.
 * Returns details about why the error is ignorable.
 */
export const isIgnorableError = (error: unknown): IgnorableErrorResult => {
  let message = ''

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message)
  }

  if (!message) {
    return { isIgnorable: false }
  }

  // Check user rejection patterns
  const userRejectionMatch = matchesPatterns(message, USER_REJECTION_PATTERNS)
  if (userRejectionMatch) {
    return {
      isIgnorable: true,
      category: 'user_initiated',
      reason: userRejectionMatch
    }
  }

  // Check expected state patterns
  const expectedStateMatch = matchesPatterns(message, EXPECTED_STATE_PATTERNS)
  if (expectedStateMatch) {
    return {
      isIgnorable: true,
      category: 'expected_state',
      reason: expectedStateMatch
    }
  }

  // Check network transient patterns
  const networkMatch = matchesPatterns(message, NETWORK_TRANSIENT_PATTERNS)
  if (networkMatch) {
    return {
      isIgnorable: true,
      category: 'network_transient',
      reason: networkMatch
    }
  }

  // Check wallet session patterns
  const walletSessionMatch = matchesPatterns(message, WALLET_SESSION_PATTERNS)
  if (walletSessionMatch) {
    return {
      isIgnorable: true,
      category: 'wallet_session',
      reason: walletSessionMatch
    }
  }

  // Check browser environment patterns
  const browserEnvironmentMatch = matchesPatterns(message, BROWSER_ENVIRONMENT_PATTERNS)
  if (browserEnvironmentMatch) {
    return {
      isIgnorable: true,
      category: 'browser_environment',
      reason: browserEnvironmentMatch
    }
  }

  return { isIgnorable: false }
}

/**
 * Check if an error is ignorable by its message string directly
 */
export const isIgnorableErrorMessage = (message: string): boolean => {
  return isIgnorableError({ message }).isIgnorable
}
