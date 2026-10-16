import { isValidUuidV4 } from '../../../shared/locations'
import { ConnectionOptionType } from '../../Connection'

/**
 * Parses a provider string into a ConnectionOptionType enum value.
 * Handles various formats: 'google', 'wallet-connect', 'walletconnect', 'wallet_connect', etc.
 * @returns The corresponding ConnectionOptionType or null if not found.
 */
const parseConnectionOptionType = (provider: string | null): ConnectionOptionType | null => {
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

// The OAuth round trip to /mobile/callback drops the query string, so the id rides in this tab's sessionStorage.
const MOBILE_AUTH_REQUEST_ID_STORAGE_KEY = 'dcl_mobile_auth_request_id'

/**
 * Stores the `authRequestId` the app opened /mobile with, or clears it when absent or not a UUID v4,
 * so a later visit without one never reuses a previous attempt's id.
 * @returns The stored id, or null.
 */
const persistMobileAuthRequestId = (authRequestId: string | null): string | null => {
  const validId = authRequestId && isValidUuidV4(authRequestId) ? authRequestId.toLowerCase() : null
  try {
    if (validId) {
      sessionStorage.setItem(MOBILE_AUTH_REQUEST_ID_STORAGE_KEY, validId)
    } else {
      sessionStorage.removeItem(MOBILE_AUTH_REQUEST_ID_STORAGE_KEY)
    }
  } catch {
    // Storage can be unavailable (e.g. blocked); the login still works, just without the binding.
  }
  return validId
}

/**
 * Reads the `authRequestId` stored by persistMobileAuthRequestId.
 * @returns The stored id, or null when there is none.
 */
const getPersistedMobileAuthRequestId = (): string | null => {
  try {
    const storedId = sessionStorage.getItem(MOBILE_AUTH_REQUEST_ID_STORAGE_KEY)
    return storedId && isValidUuidV4(storedId) ? storedId : null
  } catch {
    return null
  }
}

export { parseConnectionOptionType, persistMobileAuthRequestId, getPersistedMobileAuthRequestId }
