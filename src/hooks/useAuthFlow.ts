import { useCallback, useContext } from 'react'
import { useAdvancedUserAgentData } from '@dcl/hooks'
import { ProviderType } from '@dcl/schemas'
import { connection } from 'decentraland-connect'
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
  const { flags, initialized: flagInitialized } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()
  const [isLoadingUserAgentData, userAgentData] = useAdvancedUserAgentData()
  console.log(' >>> userAgentData: ', userAgentData)
  const connectToMagic = useCallback(async () => {
    if (!flagInitialized) {
      return undefined
    }

    const providerType = flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    return await connection.connect(providerType)
  }, [flags[FeatureFlagsKeys.MAGIC_TEST], flagInitialized])

  const checkProfileAndRedirect = useCallback(
    async (account: string, referrer: string | null, redirect: () => void) => {
      if (!flagInitialized) {
        return undefined
      }

      if (!targetConfig.skipSetup && account) {
        const profile = await fetchProfile(account)
        const isNewOnboardingFlowEnabled = flags[FeatureFlagsKeys.NEW_ONBOARDING_FLOW]
        const isIos = !isLoadingUserAgentData && (userAgentData?.mobile || userAgentData?.tablet) && userAgentData.os.name === 'iOS'
        const isSafari = !isLoadingUserAgentData && userAgentData?.browser.name === 'Safari'
        const isAvatarSetupFlowAllowed = isNewOnboardingFlowEnabled && !isIos && !isSafari
        const isProfileIncomplete = !profile || !isProfileComplete(profile)
        if (isProfileIncomplete && !isAvatarSetupFlowAllowed) {
          return navigate(locations.setup(redirectTo, referrer))
        } else if (isProfileIncomplete && isAvatarSetupFlowAllowed) {
          return navigate(locations.avatarSetup(redirectTo, referrer))
        }
      }

      redirect()
    },
    [targetConfig.skipSetup, flags, navigate, redirectTo, flagInitialized, isLoadingUserAgentData, userAgentData]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    isInitialized: flagInitialized
  }
}
