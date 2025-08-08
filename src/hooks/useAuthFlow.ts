import { useCallback, useContext } from 'react'
import { ProviderType } from '@dcl/schemas'
import { getConfiguration, connection } from 'decentraland-connect'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../components/FeatureFlagsProvider'
import { fetchProfile } from '../modules/profile'
import { locations } from '../shared/locations'
import { isProfileComplete } from '../shared/profile'
import { useNavigateWithSearchParams } from './navigation'
import { useAfterLoginRedirection } from './redirection'
import { useTargetConfig } from './targetConfig'

export const useAuthFlow = () => {
  const navigate = useNavigateWithSearchParams()
  const { url: redirectTo } = useAfterLoginRedirection()
  const { flags } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

  const shouldUseTestMagic = useCallback(() => {
    return Boolean(flags[FeatureFlagsKeys.MAGIC_TEST])
  }, [flags])

  const connectToMagic = useCallback(async () => {
    const providerType = shouldUseTestMagic() ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    return await connection.connect(providerType)
  }, [shouldUseTestMagic])

  const checkProfileAndRedirect = useCallback(
    async (account: string, referrer: string | null, redirect: () => void) => {
      if (!targetConfig.skipSetup && account) {
        const profile = await fetchProfile(account)

        if (!profile && !flags[FeatureFlagsKeys.NEW_ONBOARDING_FLOW]) {
          return navigate(locations.setup(redirectTo, referrer))
        } else if (profile && !isProfileComplete(profile)) {
          return navigate(locations.setup(redirectTo, referrer))
        }
      }

      redirect()
    },
    [targetConfig.skipSetup, flags, navigate, redirectTo]
  )

  const getMagicConfig = useCallback(
    () => (shouldUseTestMagic() ? getConfiguration().magic_test : getConfiguration().magic),
    [shouldUseTestMagic]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    getMagicConfig,
    shouldUseTestMagic
  }
}
