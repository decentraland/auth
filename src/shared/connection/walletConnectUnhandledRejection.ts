import { clearWalletConnectStorage, isWalletConnectStaleSessionError } from './walletConnect'

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', event => {
    if (!isWalletConnectStaleSessionError(event.reason)) return

    // WalletConnect v2 can emit unhandled promise rejections for stale session/proposal state.
    // We prevent the default browser logging to keep the console/Sentry clean and cleanup WC storage
    // so the next explicit connect attempt starts from a known-good state.
    event.preventDefault()
    event.stopImmediatePropagation()

    clearWalletConnectStorage()
  })
}
