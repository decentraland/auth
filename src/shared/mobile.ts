interface MobileSession {
  u?: string
  s?: string
}

// In-memory cache: survives SPA navigations without localStorage
let cachedSession: MobileSession | null | undefined

// Helper that parses the state param from the OAuth callback (same pattern as extractRedirectToFromSearchParameters)
function extractMobileDataFromState(): { isMobileFlow?: boolean; mobileUserId?: string; mobileSessionId?: string } | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('state')
    if (state) {
      const decoded = JSON.parse(atob(state))
      const customData = JSON.parse(decoded.customData)
      return {
        isMobileFlow: customData.isMobileFlow,
        mobileUserId: customData.mobileUserId,
        mobileSessionId: customData.mobileSessionId
      }
    }
  } catch {
    // ignore malformed state
  }
  return null
}

function getMobileSession(): MobileSession | null {
  if (cachedSession !== undefined) {
    return cachedSession
  }

  const params = new URLSearchParams(window.location.search)

  // On /auth/mobile, read from URL params
  if (window.location.pathname.startsWith('/auth/mobile')) {
    cachedSession = { u: params.get('u') ?? undefined, s: params.get('s') ?? undefined }
    return cachedSession
  }

  // On callback, extract from OAuth state param
  const stateData = extractMobileDataFromState()
  if (stateData?.isMobileFlow) {
    cachedSession = {
      u: stateData.mobileUserId ?? undefined,
      s: stateData.mobileSessionId ?? undefined
    }
    return cachedSession
  }

  return null
}

function isMobileSession(): boolean {
  return getMobileSession() !== null
}

// Exported for testing only
function resetMobileSession(): void {
  cachedSession = undefined
}

/**
 * Mirror Magic's PKCE code verifier from sessionStorage to localStorage.
 *
 * Mobile Safari may evict the tab's sessionStorage during an OAuth redirect.
 * Magic's loginWithRedirect() writes `magic_oauth_pkce_verifier` to
 * sessionStorage DURING its async body (after an iframe RPC round-trip, right
 * before the redirect), so a pre-redirect snapshot would miss it.
 *
 * We patch Storage.prototype.setItem (not the instance — the Storage spec's
 * named property setter would intercept instance assignment and store the
 * function as a literal string entry). Only the PKCE key is mirrored.
 *
 * Call this before loginWithRedirect().
 */
const PKCE_KEY = 'magic_oauth_pkce_verifier'
const PKCE_MIRROR_KEY = '_ss_mirror:magic_oauth_pkce_verifier'

let mirroring = false

function mirrorSessionStorageWrites(): void {
  if (mirroring) return
  mirroring = true

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalSetItem = Storage.prototype.setItem

  Storage.prototype.setItem = function (key: string, value: string) {
    originalSetItem.call(this, key, value)
    if (this === sessionStorage && key === PKCE_KEY) {
      try {
        originalSetItem.call(localStorage, PKCE_MIRROR_KEY, value)
      } catch {
        // localStorage full — best effort
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalRemoveItem = Storage.prototype.removeItem

  Storage.prototype.removeItem = function (key: string) {
    originalRemoveItem.call(this, key)
    if (this === sessionStorage && key === PKCE_KEY) {
      originalRemoveItem.call(localStorage, PKCE_MIRROR_KEY)
    }
  }
}

/**
 * Restore the PKCE code verifier from its localStorage mirror.
 *
 * Only restores if the key is missing from sessionStorage (iOS eviction case).
 * Always cleans up the mirror key afterwards.
 */
function restoreSessionStorageMirror(): boolean {
  const mirrorValue = localStorage.getItem(PKCE_MIRROR_KEY)
  if (mirrorValue === null) return false

  const needsRestore = sessionStorage.getItem(PKCE_KEY) === null

  if (needsRestore) {
    sessionStorage.setItem(PKCE_KEY, mirrorValue)
  }

  localStorage.removeItem(PKCE_MIRROR_KEY)
  return needsRestore
}

export type { MobileSession }
export { getMobileSession, isMobileSession, resetMobileSession, mirrorSessionStorageWrites, restoreSessionStorageMirror }
