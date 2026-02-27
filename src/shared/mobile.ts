export interface MobileSession {
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

export function getMobileSession(): MobileSession | null {
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

export function isMobileSession(): boolean {
  return getMobileSession() !== null
}

// Exported for testing only
export function resetMobileSession(): void {
  cachedSession = undefined
}

/**
 * Mirror sessionStorage writes to localStorage in real time.
 *
 * Mobile Safari may evict the tab's sessionStorage during an OAuth redirect.
 * Magic's loginWithRedirect() writes the PKCE code verifier to sessionStorage
 * DURING its async body (after an iframe RPC round-trip, right before the
 * redirect), so a pre-redirect snapshot would miss it.
 *
 * Instead, we monkey-patch sessionStorage.setItem so every write is also
 * persisted to localStorage under a prefix. On the callback page,
 * restoreSessionStorageMirror() replays the mirrored keys if sessionStorage
 * was evicted.
 *
 * Call this before loginWithRedirect(). The patch is naturally discarded when
 * the page navigates away.
 */
const SS_MIRROR_PREFIX = '_ss_mirror:'

let mirroring = false

export function mirrorSessionStorageWrites(): void {
  if (mirroring) return
  mirroring = true

  const originalSetItem = Storage.prototype.setItem

  Storage.prototype.setItem = function (key: string, value: string) {
    originalSetItem.call(this, key, value)
    if (this === sessionStorage) {
      try {
        originalSetItem.call(localStorage, SS_MIRROR_PREFIX + key, value)
      } catch {
        // localStorage full — best effort
      }
    }
  }

  const originalRemoveItem = Storage.prototype.removeItem

  Storage.prototype.removeItem = function (key: string) {
    originalRemoveItem.call(this, key)
    if (this === sessionStorage) {
      originalRemoveItem.call(localStorage, SS_MIRROR_PREFIX + key)
    }
  }
}

/**
 * Restore sessionStorage from mirrored localStorage keys.
 *
 * Only restores when sessionStorage is empty (iOS eviction case) so we never
 * overwrite a healthy session. Always cleans up the mirror keys afterwards.
 */
export function restoreSessionStorageMirror(): boolean {
  const mirrorKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(SS_MIRROR_PREFIX)) {
      mirrorKeys.push(key)
    }
  }

  if (mirrorKeys.length === 0) return false

  const shouldRestore = sessionStorage.length === 0

  if (shouldRestore) {
    for (const key of mirrorKeys) {
      const value = localStorage.getItem(key)
      if (value !== null) {
        sessionStorage.setItem(key.slice(SS_MIRROR_PREFIX.length), value)
      }
    }
  }

  for (const key of mirrorKeys) {
    localStorage.removeItem(key)
  }
  return shouldRestore
}
