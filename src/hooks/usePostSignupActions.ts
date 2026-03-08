import { useCallback, useRef } from 'react'
import { EthAddress } from '@dcl/schemas'
import { subscribeToNewsletter } from '../components/Pages/SetupPage/utils'
import { handleError } from '../shared/utils/errorHandler'
import { useTrackReferral } from './useTrackReferral'

/**
 * Shared hook for post-signup side effects: referral tracking and newsletter subscription.
 * Used by both SetupPage and AvatarSetupPage.
 */
export const usePostSignupActions = (referrer: string | null) => {
  const { track: trackReferral } = useTrackReferral()
  const hasTrackedReferral = useRef(false)

  const trackReferralOnDeploy = useCallback(async () => {
    if (referrer && EthAddress.validate(referrer)) {
      try {
        await trackReferral(referrer, 'PATCH')
      } catch {
        // Error is already handled in trackReferral
      }
    }
  }, [referrer, trackReferral])

  const trackReferralOnInit = useCallback(async () => {
    if (referrer && EthAddress.validate(referrer) && !hasTrackedReferral.current) {
      try {
        await trackReferral(referrer, 'POST')
        hasTrackedReferral.current = true
      } catch {
        // Error is already handled in trackReferral
      }
    }
  }, [referrer, trackReferral])

  const subscribeEmail = useCallback(async (email: string) => {
    if (email) {
      try {
        await subscribeToNewsletter(email)
      } catch (e) {
        handleError(e, 'Error subscribing to newsletter', { skipTracking: true })
      }
    }
  }, [])

  return { trackReferralOnDeploy, trackReferralOnInit, subscribeEmail, hasTrackedReferral }
}
