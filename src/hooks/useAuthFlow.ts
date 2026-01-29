import { useCallback, useContext } from 'react'
import { ProviderType } from '@dcl/schemas'
import { connection } from 'decentraland-connect'
import { FeatureFlagsContext, FeatureFlagsKeys, OnboardingFlowVariant } from '../components/FeatureFlagsProvider'
import { fetchProfile } from '../modules/profile'
import { locations } from '../shared/locations'
import { isProfileComplete } from '../shared/profile'
import { checkWebGpuSupport } from '../shared/utils/webgpu'
import { useNavigateWithSearchParams } from './navigation'
import { useAfterLoginRedirection } from './redirection'
import { useTargetConfig } from './targetConfig'
import { useAnalytics } from './useAnalytics'

/**
 * Custom hook that manages authentication flow logic including Magic connection
 * and profile validation with redirects based on profile state and feature flags.
 *
 * @returns {{
 *   checkProfileAndRedirect: (account: string, referrer: string | null, redirect: () => void) => Promise<void>,
 *   connectToMagic: () => Promise<import('decentraland-connect').ConnectionResponse | undefined>,
 *   isInitialized: boolean
 * }} Authentication flow utilities and initialization status
 */
export const useAuthFlow = () => {
  const navigate = useNavigateWithSearchParams()
  const { url: redirectTo } = useAfterLoginRedirection()
  const { flags, variants, initialized: flagInitialized } = useContext(FeatureFlagsContext)

  const [targetConfig] = useTargetConfig()
  const { trackWebGPUSupportCheck } = useAnalytics()

  /**
   * Connects to the Magic wallet provider based on the current feature flag configuration.
   * Returns undefined if feature flags are not yet initialized.
   *
   * @returns {Promise<import('decentraland-connect').ConnectionResponse | undefined>} Resolves with the connection data,
   * or undefined when feature flags are not ready
   */
  const connectToMagic = useCallback(async () => {
    if (!flagInitialized) {
      return undefined
    }

    const providerType = flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    return await connection.connect(providerType)
  }, [flags[FeatureFlagsKeys.MAGIC_TEST], flagInitialized])

  /**
   * Checks if profile exists and redirects based on profile state.
   * Navigates to setup/avatar setup flows based on feature flags and WebGPU support.
   *
   * @param {string} account - The user's account address
   * @param {string | null} referrer - The referrer URL string or null
   * @param {() => void} redirect - Callback function to execute for successful redirect
   * @returns {Promise<void>} A promise that resolves after the navigation or redirect completes
   */
  const checkProfileAndRedirect = useCallback(
    async (account: string, referrer: string | null, redirect: () => void) => {
      if (!flagInitialized) {
        return undefined
      }

      if (targetConfig && !targetConfig.skipSetup && account) {
        const profile = await fetchProfile(account)

        // Check A/B testing new onboarding flow
        const isFlowV2OnboardingFlowEnabled = variants[FeatureFlagsKeys.ONBOARDING_FLOW]?.name === OnboardingFlowVariant.V2
        const hasWebGPU = await checkWebGpuSupport()
        trackWebGPUSupportCheck({ supported: hasWebGPU })
        const isAvatarSetupFlowAllowed = isFlowV2OnboardingFlowEnabled && hasWebGPU
        const isProfileIncomplete = !profile || !isProfileComplete(profile)

        if (isProfileIncomplete && !isAvatarSetupFlowAllowed) {
          return navigate(locations.setup(redirectTo, referrer))
        } else if (isProfileIncomplete && isAvatarSetupFlowAllowed) {
          return navigate(locations.avatarSetup(redirectTo, referrer))
        }
      }

      redirect()
    },
    [targetConfig?.skipSetup, variants[FeatureFlagsKeys.ONBOARDING_FLOW], navigate, redirectTo, flagInitialized]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    isInitialized: flagInitialized
  }
}
