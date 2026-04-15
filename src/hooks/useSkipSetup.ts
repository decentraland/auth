import { useContext } from 'react'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../components/FeatureFlagsProvider'
import { useAfterLoginRedirection } from './redirection'
import { useTargetConfig } from './targetConfig'

/**
 * Returns true when web-based profile setup should be skipped entirely.
 *
 * Skip conditions:
 * 1. targetConfig.skipSetup — the caller (mobile, Explorer) handles setup itself
 * 2. ONBOARDING_TO_EXPLORER FF + no explicit redirect — user comes from Explorer,
 *    onboarding happens in-app. For web flows (with redirectTo), we still check
 *    the profile and show a compact onboarding if needed.
 */
export const useSkipSetup = (): boolean => {
  const [targetConfig] = useTargetConfig()
  const { flags } = useContext(FeatureFlagsContext)
  const { hasExplicitRedirect } = useAfterLoginRedirection()
  const ffEnabled = !!flags[FeatureFlagsKeys.ONBOARDING_TO_EXPLORER]
  // FF only skips setup for Explorer flow (no redirectTo).
  // For web (has redirectTo), ensureProfile still runs but navigates to compact onboarding.
  const result = !!(targetConfig?.skipSetup || (ffEnabled && !hasExplicitRedirect))
  return result
}
