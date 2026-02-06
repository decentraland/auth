import { ConnectionOptionType } from '../../Connection'

export const MOBILE_AUTH_FLOW_KEY = 'dcl-mobile-auth-flow'

/**
 * Sets a flag in localStorage to indicate the auth flow originated from /auth/mobile.
 * This is used by CallbackPage to determine whether to render MobileCallbackPage.
 */
export const setMobileAuthFlow = (): void => {
  localStorage.setItem(MOBILE_AUTH_FLOW_KEY, 'true')
}

/**
 * Checks if the current auth flow is a mobile flow.
 * Returns true if on /auth/mobile path or if localStorage flag is set (for OAuth callback).
 */
export const isMobileAuthFlow = (): boolean => {
  if (window.location.pathname.startsWith('/auth/mobile')) {
    return true
  }
  return localStorage.getItem(MOBILE_AUTH_FLOW_KEY) === 'true'
}

/**
 * Clears the mobile auth flow flag from localStorage.
 * Should be called after the OAuth callback is processed (success or error).
 */
export const clearMobileAuthFlow = (): void => {
  localStorage.removeItem(MOBILE_AUTH_FLOW_KEY)
}

/**
 * Parses a provider string into a ConnectionOptionType enum value.
 * Handles various formats: 'google', 'wallet-connect', 'walletconnect', 'wallet_connect', etc.
 * @returns The corresponding ConnectionOptionType or null if not found.
 */
export const parseConnectionOptionType = (provider: string | null): ConnectionOptionType | null => {
  if (!provider) return null

  const normalized = provider.toLowerCase().trim()

  // Direct match with enum values
  const enumValues = Object.values(ConnectionOptionType) as string[]
  if (enumValues.includes(normalized)) {
    return normalized as ConnectionOptionType
  }

  // Handle aliases for mobile-supported options only
  const aliases = new Map<string, ConnectionOptionType>([
    ['walletconnect', ConnectionOptionType.WALLET_CONNECT],
    ['wallet_connect', ConnectionOptionType.WALLET_CONNECT],
    ['twitter', ConnectionOptionType.X]
  ])

  return aliases.get(normalized) ?? null
}
