import { SOCIAL_PROVIDER_TYPES } from './socialProviders'

const WALLET_LOGIN_METHODS = new Set(['METAMASK', 'WALLETCONNECT', 'COINBASE', 'FORTMATIC'])

/**
 * Checks if the active session provider type matches the requested login method.
 * Returns true if there's a mismatch (e.g., social session but wallet login requested).
 */
export function isSessionMismatch(providerType: string | undefined, loginMethod: string | null): boolean {
  if (!loginMethod || !providerType) return false

  const isSocialSession = SOCIAL_PROVIDER_TYPES.has(providerType)
  const isWalletLoginMethod = WALLET_LOGIN_METHODS.has(loginMethod.toUpperCase())

  // Mismatch: social session + wallet login request, or wallet session + social login request
  return (isSocialSession && isWalletLoginMethod) || (!isSocialSession && !isWalletLoginMethod)
}
