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
