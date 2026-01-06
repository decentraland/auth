import { useCallback, useContext } from 'react'
import type { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { connection } from 'decentraland-connect'
import { FeatureFlagsContext, FeatureFlagsKeys, OnboardingFlowVariant } from '../components/FeatureFlagsProvider'
import { config } from '../modules/config'
import { fetchProfileWithConsistencyCheck, redeployExistingProfile, redeployExistingProfileWithContentServerData } from '../modules/profile'
import { createFetcher } from '../shared/fetcher'
import { locations } from '../shared/locations'
import { isProfileComplete } from '../shared/profile'
import { checkWebGpuSupport } from '../shared/utils/webgpu'
import { useNavigateWithSearchParams } from './navigation'
import { useAfterLoginRedirection } from './redirection'
import { useTargetConfig } from './targetConfig'
import { useDisabledCatalysts } from './useDisabledCatalysts'

/**
 * Custom hook that manages authentication flow logic including Magic connection
 * and profile validation with redirects based on profile state and feature flags.
 *
 * @returns {{
 *   checkProfileAndRedirect: (account: string, referrer: string | null, redirect: () => void, providedIdentity?: AuthIdentity | null) => Promise<void>,
 *   connectToMagic: () => Promise<import('decentraland-connect').ConnectionResponse | undefined>,
 *   isInitialized: boolean
 * }} Authentication flow utilities and initialization status
 */
export const useAuthFlow = () => {
  const navigate = useNavigateWithSearchParams()
  const { url: redirectTo } = useAfterLoginRedirection()
  const { flags, variants, initialized: flagInitialized } = useContext(FeatureFlagsContext)

  const [targetConfig] = useTargetConfig()
  const disabledCatalysts = useDisabledCatalysts()

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
   * Checks profile consistency across catalysts and redirects based on profile state.
   * Handles profile redeployment if inconsistent, and navigates to setup/avatar setup
   * flows based on feature flags and WebGPU support.
   *
   * @param {string} account - The user's account address
   * @param {string | null} referrer - The referrer URL string or null
   * @param {() => void} redirect - Callback function to execute for successful redirect
   * @param {AuthIdentity | null} [providedIdentity] - Optional authentication identity to use for redeployment.
   * Falls back to hook identity if not provided.
   * @returns {Promise<void>} A promise that resolves after the navigation or redirect completes
   */
  const checkProfileAndRedirect = useCallback(
    async (account: string, referrer: string | null, redirect: () => void, providedIdentity: AuthIdentity | null = null) => {
      if (!flagInitialized) {
        return undefined
      }

      if (targetConfig && !targetConfig.skipSetup && account) {
        // Check profile consistency across all catalysts
        const fetcherWithTimeout = createFetcher({
          timeout: Number(config.get('PROFILE_CONSISTENCY_CHECK_TIMEOUT')) ?? 10000
        })

        const consistencyResult = await fetchProfileWithConsistencyCheck(account, disabledCatalysts, fetcherWithTimeout)

        // Check A/B testing new onboarding flow
        const isFlowV2OnboardingFlowEnabled = variants[FeatureFlagsKeys.ONBOARDING_FLOW]?.name === OnboardingFlowVariant.V2

        // If profile is not consistent across catalysts, try to redeploy if we have a valid entity
        if (!consistencyResult.isConsistent) {
          // Use provided identity first, then fall back to localStorage identity (no provider init side-effects)
          // Rationale: reading identity from localStorage avoids triggering provider initialization (e.g. WalletConnect) during page load.
          const userIdentity = providedIdentity ?? localStorageGetIdentity(account.toLowerCase())

          // If we have a valid entity and user identity, attempt redeployment
          if (consistencyResult.profile && consistencyResult.profileFetchedFrom && userIdentity) {
            try {
              await redeployExistingProfile(consistencyResult.profile, account, userIdentity, disabledCatalysts, fetcherWithTimeout)
              // If redeployment succeeds, continue with the login flow
              return redirect()
            } catch (error) {
              console.warn('Profile redeployment failed, attempting to redeploy with content server data:', error)
              // If redeployment with lamb2 profile fails, try to redeploy with content server data
              try {
                await redeployExistingProfileWithContentServerData(
                  consistencyResult.profileFetchedFrom,
                  account,
                  userIdentity,
                  disabledCatalysts,
                  fetcherWithTimeout
                )
                // If redeployment succeeds, continue with the login flow
                return redirect()
              } catch (error) {
                console.warn('Profile redeployment failed, falling back to onboarding:', error)
                // Fall through to onboarding flow
              }
            }
          }

          // Fallback to onboarding flow (original behavior)
          const hasWebGPU = await checkWebGpuSupport()
          const isAvatarSetupFlowAllowed = isFlowV2OnboardingFlowEnabled && hasWebGPU

          if (isAvatarSetupFlowAllowed) {
            return navigate(locations.avatarSetup(redirectTo, referrer))
          } else {
            return navigate(locations.setup(redirectTo, referrer))
          }
        }

        // If consistent, check if profile exists and is complete
        const profile: Profile | undefined = consistencyResult.profile
        const hasWebGPU = await checkWebGpuSupport()
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
    [targetConfig?.skipSetup, variants[FeatureFlagsKeys.ONBOARDING_FLOW], navigate, redirectTo, flagInitialized, disabledCatalysts]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    isInitialized: flagInitialized
  }
}
