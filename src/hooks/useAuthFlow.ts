import { useCallback, useContext, useEffect, useState } from 'react'
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
  const [hasWebGPU, setHasWebGPU] = useState(false)
  const [isCheckingWebGPU, setIsCheckingWebGPU] = useState(true)

  useEffect(() => {
    async function checkWebGpu() {
      setIsCheckingWebGPU(true)

      if (!('gpu' in navigator)) {
        setHasWebGPU(false)
        setIsCheckingWebGPU(false)
        return
      }

      try {
        const adapter = await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()
        setHasWebGPU(!!adapter)
      } catch {
        setHasWebGPU(false)
      } finally {
        setIsCheckingWebGPU(false)
      }
    }
    checkWebGpu()
  }, [])

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

      if (isCheckingWebGPU) {
        return undefined
      }

      if (targetConfig && !targetConfig.skipSetup && account) {
        const profile = await fetchProfile(account)
        const isNewOnboardingFlowEnabled = flags[FeatureFlagsKeys.NEW_ONBOARDING_FLOW]
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
    [targetConfig?.skipSetup, flags, navigate, redirectTo, flagInitialized, hasWebGPU, isCheckingWebGPU]
  )

  return {
    checkProfileAndRedirect,
    connectToMagic,
    isInitialized: flagInitialized,
    isCheckingWebGPU
  }
}
