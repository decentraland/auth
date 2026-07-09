import { ProviderType } from '@dcl/schemas'

/**
 * Provider types backed by a social / web2 login (Magic and Thirdweb). These wallets
 * sign and send transactions without their own confirmation UI, so the auth site is
 * responsible for showing the user what they are approving. External wallets
 * (MetaMask, WalletConnect, etc.) surface their own confirmation and are excluded.
 */
const SOCIAL_PROVIDER_TYPES = new Set<string>([ProviderType.MAGIC, ProviderType.MAGIC_TEST, ProviderType.THIRDWEB])

/**
 * Returns true when the given provider type is a social / web2 wallet (Magic or Thirdweb).
 * Prefer this over checking `provider.isMagic`, which misses Thirdweb.
 */
function isSocialProviderType(providerType: ProviderType | string | undefined): boolean {
  if (!providerType) return false
  return SOCIAL_PROVIDER_TYPES.has(providerType)
}

export { SOCIAL_PROVIDER_TYPES, isSocialProviderType }
