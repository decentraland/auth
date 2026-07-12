import { useCallback } from 'react'
import { IFetchComponent } from '@well-known-components/interfaces'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity } from '@dcl/crypto'
import { fetchProfileWithConsistencyCheck, redeployExistingProfile, redeployExistingProfileWithContentServerData } from '../modules/profile'
import { useDisabledCatalysts } from './useDisabledCatalysts'

interface CheckProfileConsistencyResult {
  profile: Profile | undefined
  isConsistent: boolean
  // Propagated from the consistency check: true when no catalyst could be reached, so the
  // absence of a profile is inconclusive rather than authoritative.
  couldNotDetermine: boolean
}

/**
 * Hook that checks profile consistency across catalysts and redeploys if needed.
 * Returns the profile and consistency status without performing any navigation.
 */
export const useProfileConsistency = () => {
  const disabledCatalysts = useDisabledCatalysts()

  const checkProfileConsistency = useCallback(
    async (
      account: string,
      identity: AuthIdentity | undefined | null,
      fetcher?: IFetchComponent
    ): Promise<CheckProfileConsistencyResult> => {
      const consistencyResult = await fetchProfileWithConsistencyCheck(account, disabledCatalysts, fetcher)

      // Propagate the indeterminate state without attempting any redeploy — there is no profile
      // to redeploy and the caller must not treat this as "no profile".
      if (consistencyResult.couldNotDetermine) {
        return {
          profile: undefined,
          isConsistent: false,
          couldNotDetermine: true
        }
      }

      if (!consistencyResult.isConsistent && consistencyResult.profile && identity) {
        try {
          await redeployExistingProfile(consistencyResult.profile, account, identity, disabledCatalysts)
        } catch (error) {
          console.warn('Profile redeployment failed:', error)

          // If the profile was fetched from a specific catalyst, try redeploying with content server data
          if (consistencyResult.profileFetchedFrom) {
            try {
              await redeployExistingProfileWithContentServerData(consistencyResult.profileFetchedFrom, account, identity, disabledCatalysts)
            } catch (contentServerError) {
              console.warn('Profile redeployment with content server data also failed:', contentServerError)
            }
          }
        }
      }

      return {
        profile: consistencyResult.profile,
        isConsistent: consistencyResult.isConsistent,
        couldNotDetermine: false
      }
    },
    [disabledCatalysts]
  )

  return { checkProfileConsistency }
}
