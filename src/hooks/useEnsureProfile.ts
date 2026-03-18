import { useCallback } from 'react'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity } from '@dcl/crypto'
import { config } from '../modules/config'
import { createFetcher } from '../shared/fetcher'
import { isProfileComplete } from '../shared/profile'
import { useProfileConsistency } from './useProfileConsistency'
import { useSetupNavigation } from './useSetupNavigation'

/**
 * Composition hook that checks profile consistency, redeploys if needed,
 * and navigates to setup if the profile is incomplete or missing.
 *
 * @returns ensureProfile — resolves with the profile if complete,
 * or null if it navigated to setup.
 */
export const useEnsureProfile = () => {
  const { checkProfileConsistency } = useProfileConsistency()
  const { navigateToSetup } = useSetupNavigation()

  const ensureProfile = useCallback(
    async (
      account: string,
      identity: AuthIdentity | undefined | null,
      options: {
        redirectTo: string
        referrer: string | null
        navigateOptions?: { replace?: boolean }
      }
    ): Promise<Profile | null> => {
      const fetcherWithTimeout = createFetcher({
        timeout: Number(config.get('PROFILE_CONSISTENCY_CHECK_TIMEOUT')) || 10000
      })

      const { profile } = await checkProfileConsistency(account, identity, fetcherWithTimeout)

      if (!profile || !isProfileComplete(profile)) {
        await navigateToSetup(options.redirectTo, options.referrer, options.navigateOptions)
        return null
      }

      return profile
    },
    [checkProfileConsistency, navigateToSetup]
  )

  return { ensureProfile }
}
