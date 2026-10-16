import { ConnectionOptionType } from '../components/Connection'
import { isValidUuidV4 } from './locations'

// Only the fields actually consumed by the app. Other customData entries
// (redirectTo, referrer, etc.) are not cached so they don't linger in memory.
interface OAuthCustomState {
  isMobileFlow?: boolean
  mobileUserId?: string
  mobileSessionId?: string
  authRequestId?: string
  connectionOption?: ConnectionOptionType
}

// Module-scoped cache: survives SPA navigations without localStorage, and lets consumers
// read the state after Magic's getRedirectResult() strips it from the URL — as long as the
// first read happened before that strip.
let cachedCustomData: OAuthCustomState | null | undefined

// Parses the OAuth `state` query param produced by the social-login redirect.
// Returns null on missing/malformed state.
function extractCustomDataFromState(): OAuthCustomState | null {
  if (cachedCustomData !== undefined) {
    return cachedCustomData
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('state')
    if (state) {
      const decoded = JSON.parse(atob(state))
      const raw = JSON.parse(decoded.customData)
      cachedCustomData = {
        isMobileFlow: raw.isMobileFlow,
        mobileUserId: raw.mobileUserId,
        mobileSessionId: raw.mobileSessionId,
        authRequestId: raw.authRequestId,
        connectionOption: raw.connectionOption
      }
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

// The authRequestId the app opened /mobile with, or null when absent or not a UUID v4.
function getAuthRequestIdFromState(): string | null {
  const value = extractCustomDataFromState()?.authRequestId
  return typeof value === 'string' && isValidUuidV4(value) ? value.toLowerCase() : null
}

// Exported for testing only
function resetOauthStateCache(): void {
  cachedCustomData = undefined
}

export type { OAuthCustomState }
export { extractCustomDataFromState, getAuthRequestIdFromState, getConnectionOptionFromState, resetOauthStateCache }
