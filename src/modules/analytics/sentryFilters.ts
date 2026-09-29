import type { ErrorEvent } from '@sentry/react'

/**
 * Sentry `beforeSend` filter — drops events that are not actionable application faults.
 *
 * Separated from `sentry.ts` so the rules can be unit-tested without importing the
 * side-effectful `init()` call (which references `import.meta.env`).
 */
export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  // Filter out exceptions from GTM and STAG
  if (
    event.exception?.values?.some(exception =>
      exception.stacktrace?.frames?.some(frame => frame.filename?.includes('gtm') || frame.filename?.includes('stag'))
    )
  ) {
    return null
  }
  // Filter out clipboard errors when the document is not focused
  if (
    event.exception?.values?.some(exception => exception.type === 'DOMException' && exception.value?.includes('Document is not focused'))
  ) {
    return null
  }
  // Filter out "JS idle timeout exceeded" errors from third-party scripts
  if (
    event.exception?.values?.some(
      exception => exception.value?.includes('idle timeout exceeded') && exception.stacktrace?.frames?.every(frame => !frame.in_app)
    )
  ) {
    return null
  }
  // Filter out WalletConnect stale-session-topic errors.
  // The relay may deliver a message after the local session has been removed (disconnect, expiry,
  // cleared storage). The sign-client's isValidSessionTopic throws, and because the throw is
  // inside the library's own onRelayMessage handler, it surfaces as an unhandled rejection with
  // no application frames — there is nothing for us to catch or fix.
  if (
    event.exception?.values?.some(
      exception =>
        exception.value?.includes("session topic doesn't exist") &&
        exception.stacktrace?.frames?.some(frame => frame.module?.includes('walletconnect'))
    )
  ) {
    return null
  }
  return event
}
