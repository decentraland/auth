import { connection } from 'decentraland-connect'
import { isErrorWithMessage } from '../errors'

const WALLET_CONNECT_STORAGE_KEY_PATTERNS = [/^wc@2:/i, /walletconnect/i]

function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error
  if (isErrorWithMessage(error) && typeof error.message === 'string') return error.message
  return undefined
}

export function isWalletConnectStaleSessionError(error: unknown): boolean {
  // WalletConnect errors are sometimes thrown as raw strings and sometimes as Error-like objects.
  // Normalizing to a message string makes the detection resilient across versions/transports.
  const message = getErrorMessage(error)
  if (!message) return false

  // These messages come from WalletConnect v2 when local storage contains stale proposals/sessions.
  // Treat them as recoverable by clearing WalletConnect storage and letting the user reconnect.
  return /no matching key|session topic.*doesn'?t exist|pending session not found/i.test(message)
}

export function clearWalletConnectStorage(): void {
  if (typeof localStorage === 'undefined') return

  // WalletConnect v2 persists multiple keys. We remove only WC-related keys to avoid deleting unrelated app state.
  for (const key of Object.keys(localStorage)) {
    if (WALLET_CONNECT_STORAGE_KEY_PATTERNS.some(pattern => pattern.test(key))) {
      localStorage.removeItem(key)
    }
  }
}

export async function resetWalletConnectConnection(): Promise<void> {
  // We do a best-effort reset:
  // - clearing storage removes stale WC proposals/sessions
  // - disconnecting clears decentraland-connect's stored connector state (if any)
  // Both operations are safe to attempt and errors are intentionally ignored.
  try {
    clearWalletConnectStorage()
  } catch (_error) {
    // ignore
  }

  try {
    // Note: this is best-effort; depending on the underlying connector state it might throw.
    await connection.disconnect()
  } catch (_error) {
    // ignore
  }
}
