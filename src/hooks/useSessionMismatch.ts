import { ProviderType } from '@dcl/schemas'

/**
 * Checks if the active session provider type matches the requested login method.
 * Returns true if there's a mismatch (e.g., social session but wallet login requested).
 */
export function isSessionMismatch(providerType: string | undefined, loginMethod: string | null): boolean {
  if (!loginMethod || !providerType) return false

  const isSocialSession =
    providerType === ProviderType.MAGIC || providerType === ProviderType.MAGIC_TEST || providerType === ProviderType.THIRDWEB

  const isWalletLoginMethod = loginMethod.toUpperCase() === 'METAMASK'

  return (isSocialSession && isWalletLoginMethod) || (!isSocialSession && !isWalletLoginMethod)
}
