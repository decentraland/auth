import { useCallback, useContext } from 'react'
import { FeatureFlagsContext, FeatureFlagsKeys, OnboardingFlowVariant } from '../components/FeatureFlagsProvider'
import { locations } from '../shared/locations'
import { checkWebGpuSupport } from '../shared/utils/webgpu'
import { useNavigateWithSearchParams } from './navigation'
import { useAnalytics } from './useAnalytics'

/**
 * Hook that navigates to the appropriate setup page (standard or avatar)
 * based on feature flags and WebGPU support.
 */
export const useSetupNavigation = () => {
  const navigate = useNavigateWithSearchParams()
  const { variants } = useContext(FeatureFlagsContext)
  const { trackWebGPUSupportCheck } = useAnalytics()

  const navigateToSetup = useCallback(
    async (redirectTo: string, referrer: string | null, options?: { replace?: boolean }) => {
      const isFlowV2 = variants[FeatureFlagsKeys.ONBOARDING_FLOW]?.name === OnboardingFlowVariant.V2
      const hasWebGPU = await checkWebGpuSupport()
      trackWebGPUSupportCheck({ supported: hasWebGPU })
      const isAvatarSetupAllowed = isFlowV2 && hasWebGPU

      if (isAvatarSetupAllowed) {
        navigate(locations.avatarSetup(redirectTo, referrer), options)
      } else {
        navigate(locations.setup(redirectTo, referrer), options)
      }
    },
    [navigate, variants[FeatureFlagsKeys.ONBOARDING_FLOW], trackWebGPUSupportCheck]
  )

  return { navigateToSetup }
}
