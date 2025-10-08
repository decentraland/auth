import { useCallback, useContext } from 'react'
import type { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { ProviderType } from '@dcl/schemas'
import { connection } from 'decentraland-connect'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../components/FeatureFlagsProvider'
import { fetchProfileWithConsistencyCheck, redeployExistingProfile } from '../modules/profile'
import { useCurrentConnectionData } from '../shared/connection/hook'
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
  const { identity } = useCurrentConnectionData()

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

        // If profile is not consistent across catalysts, try to redeploy if we have a valid entity
        if (!consistencyResult.isConsistent) {
          // If we have a valid entity and user identity, attempt redeployment
          if (consistencyResult.entity && identity) {
            try {
              await redeployExistingProfile(consistencyResult.entity, account, identity)
              // If redeployment succeeds, continue with the login flow
              return redirect()
            } catch (error) {
              console.warn('Profile redeployment failed, falling back to onboarding:', error)
              // Fall through to onboarding flow
            }
          }

          // Fallback to onboarding flow (original behavior)
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
        const profile: Profile | undefined = consistencyResult.entity?.metadata as Profile
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
    [targetConfig?.skipSetup, flags, navigate, redirectTo, flagInitialized, identity]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    isInitialized: flagInitialized
  }
}
