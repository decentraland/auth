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

  const connectToMagic = useCallback(async () => {
    const providerType = flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    return await connection.connect(providerType)
  }, [flags[FeatureFlagsKeys.MAGIC_TEST]])

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
    () => (flags[FeatureFlagsKeys.MAGIC_TEST] ? getConfiguration().magic_test : getConfiguration().magic),
    [flags[FeatureFlagsKeys.MAGIC_TEST]]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    getMagicConfig
  }
}
