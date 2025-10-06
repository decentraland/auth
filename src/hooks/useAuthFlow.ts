import { useCallback, useContext } from 'react'
import { ProviderType } from '@dcl/schemas'
import { connection } from 'decentraland-connect'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../components/FeatureFlagsProvider'
import { fetchProfileWithConsistencyCheck } from '../modules/profile'
import { locations } from '../shared/locations'
import { isProfileComplete } from '../shared/profile'
import { checkWebGpuSupport } from '../shared/utils/webgpu'
import { useNavigateWithSearchParams } from './navigation'
import { useAfterLoginRedirection } from './redirection'
import { useTargetConfig } from './targetConfig'

export const useAuthFlow = () => {
  const navigate = useNavigateWithSearchParams()
  const { url: redirectTo } = useAfterLoginRedirection()
  const { flags, initialized: flagInitialized } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

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

      if (targetConfig && !targetConfig.skipSetup && account) {
        // Check profile consistency across all catalysts
        const consistencyResult = await fetchProfileWithConsistencyCheck(account)
        
        // If profile is not consistent across catalysts, redirect to onboarding
        if (!consistencyResult.isConsistent) {
          const isNewOnboardingFlowEnabled = flags[FeatureFlagsKeys.NEW_ONBOARDING_FLOW]
          const hasWebGPU = await checkWebGpuSupport()
          const isAvatarSetupFlowAllowed = isNewOnboardingFlowEnabled && hasWebGPU
          
          if (isAvatarSetupFlowAllowed) {
            return navigate(locations.avatarSetup(redirectTo, referrer))
          } else {
            return navigate(locations.setup(redirectTo, referrer))
          }
        }
        
        // If consistent, check if profile exists and is complete
        const profile = consistencyResult.profile
        const isNewOnboardingFlowEnabled = flags[FeatureFlagsKeys.NEW_ONBOARDING_FLOW]
        const hasWebGPU = await checkWebGpuSupport()
        const isAvatarSetupFlowAllowed = isNewOnboardingFlowEnabled && hasWebGPU
        const isProfileIncomplete = !profile || !isProfileComplete(profile)
        
        if (isProfileIncomplete && !isAvatarSetupFlowAllowed) {
          return navigate(locations.setup(redirectTo, referrer))
        } else if (isProfileIncomplete && isAvatarSetupFlowAllowed) {
          return navigate(locations.avatarSetup(redirectTo, referrer))
        }
      }

      redirect()
    },
    [targetConfig?.skipSetup, flags, navigate, redirectTo, flagInitialized]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    isInitialized: flagInitialized
  }
}
