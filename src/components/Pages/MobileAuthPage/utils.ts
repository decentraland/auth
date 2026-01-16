import { ConnectionOptionType } from '../../Connection'

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
