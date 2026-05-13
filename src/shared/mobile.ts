import { extractCustomDataFromState } from './oauthState'

interface MobileSession {
  u?: string
  s?: string
}

// In-memory cache: survives SPA navigations without localStorage
let cachedSession: MobileSession | null | undefined

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
  const customData = extractCustomDataFromState()
  if (customData?.isMobileFlow) {
    cachedSession = {
      u: customData.mobileUserId,
      s: customData.mobileSessionId
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

export type { MobileSession }
export { getMobileSession, isMobileSession, resetMobileSession }
