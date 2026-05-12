import { ConnectionOptionType } from '../components/Connection'

interface MobileSession {
  u?: string
  s?: string
}

interface OAuthCustomState {
  isMobileFlow?: boolean
  mobileUserId?: string
  mobileSessionId?: string
  connectionOption?: ConnectionOptionType
  redirectTo?: string
  referrer?: string
}

// In-memory caches: survive SPA navigations without localStorage. Module-scoped so we don't
// re-parse the state param on every read (and so consumers can read it after Magic's
// getRedirectResult() strips it from the URL, as long as the first read happened earlier).
let cachedSession: MobileSession | null | undefined
let cachedCustomData: OAuthCustomState | null | undefined

// Parses the OAuth `state` query param produced by the social-login redirect.
// Same pattern as extractRedirectToFromSearchParameters — returns null on missing/malformed state.
function extractCustomDataFromState(): OAuthCustomState | null {
  if (cachedCustomData !== undefined) {
    return cachedCustomData
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('state')
    if (state) {
      const decoded = JSON.parse(atob(state))
      cachedCustomData = JSON.parse(decoded.customData) as OAuthCustomState
      return cachedCustomData
    }
  } catch {
    // ignore malformed state
  }
  cachedCustomData = null
  return null
}

function isConnectionOptionType(value: unknown): value is ConnectionOptionType {
  return typeof value === 'string' && (Object.values(ConnectionOptionType) as string[]).includes(value)
}

function getConnectionOptionFromState(): ConnectionOptionType | undefined {
  const value = extractCustomDataFromState()?.connectionOption
  return isConnectionOptionType(value) ? value : undefined
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
  cachedCustomData = undefined
}

export type { MobileSession, OAuthCustomState }
export { getMobileSession, isMobileSession, resetMobileSession, getConnectionOptionFromState }
