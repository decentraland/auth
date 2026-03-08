import { useContext } from 'react'
import { FeatureFlagsContext } from '../components/FeatureFlagsProvider'
import { useCurrentConnectionData } from '../shared/connection/hooks'

/**
 * Checks if the user is authenticated and feature flags are initialized.
 * Returns connection data plus readiness flags for page initialization effects.
 */
export const useRequireAuth = () => {
  const { isLoading: isConnecting, account, identity, provider, providerType, chainId } = useCurrentConnectionData()
  const { flags, variants, initialized: initializedFlags } = useContext(FeatureFlagsContext)

  const isReady = !isConnecting && initializedFlags
  const isAuthenticated = !!account && !!identity

  return {
    isReady,
    isAuthenticated,
    isConnecting,
    initializedFlags,
    account,
    identity,
    provider,
    providerType,
    chainId,
    flags,
    variants
  }
}
