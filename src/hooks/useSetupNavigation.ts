import { useCallback } from 'react'
import { locations } from '../shared/locations'
import { useNavigateWithSearchParams } from './navigation'

/**
 * Hook that navigates to the compact onboarding page (/quick-setup).
 *
 * This is the only setup page used now — the old /setup and /avatar-setup
 * pages are deprecated. The ONBOARDING_TO_EXPLORER FF controls whether
 * web setup is skipped entirely (via useSkipSetup), not which page to show.
 */
export const useSetupNavigation = () => {
  const navigate = useNavigateWithSearchParams()

  const navigateToSetup = useCallback(
    async (redirectTo: string, referrer: string | null, options?: { replace?: boolean }) => {
      navigate(locations.quickSetup(redirectTo, referrer), options)
    },
    [navigate]
  )

  return { navigateToSetup }
}
