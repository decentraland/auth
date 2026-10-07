/* eslint-disable @typescript-eslint/naming-convention */
import { useCallback } from 'react'
import { ConnectionOptionType } from '../components/Connection'
import { AvatarShape } from '../components/Pages/AvatarSetupPage/AvatarSetupPage.types'
import { consumeLoginMethod, rememberLoginMethod } from '../modules/analytics/loginMethod'
import { ClickEvents, ConnectionType, TrackingEvents } from '../modules/analytics/types'
import { TRACKING_DELAY } from '../shared/constants'
import { wait } from '../shared/time'
import { identifyUser, trackEvent, trackWithDelay } from '../shared/utils/analytics'

interface ClickData {
  method?: string
  type?: string
  [key: string]: string | number | boolean | undefined
}

export const useAnalytics = () => {
  const trackLoginClick = useCallback((data: { method?: ConnectionOptionType; type: ConnectionType | string }) => {
    // Remembered here, not in each flow, so the success event can name the provider even when the
    // login finishes on a different page load. Doing it at the single point every flow already goes
    // through is what keeps the guarantee from depending on anyone remembering it.
    rememberLoginMethod(data.method)
    trackEvent(TrackingEvents.LOGIN_CLICK, data)
  }, [])

  const trackLoginSuccess = useCallback(
    async (data: { ethAddress?: string; type: ConnectionType | string; method?: ConnectionOptionType }) => {
      // `method` names the provider the user actually logged in with, and it has to be on this event:
      // correlating success back to the preceding click by session only works for someone querying raw
      // Segment, and it breaks entirely for social logins, which return on a fresh page load after the
      // OAuth redirect. Callers that know the method pass it (the mobile deep-link entry has no click
      // to fall back on); everyone else gets it from the click that started this attempt.
      const method = data.method ?? consumeLoginMethod()

      await trackWithDelay(TrackingEvents.LOGIN_SUCCESS, {
        eth_address: data.ethAddress,
        type: data.type,
        ...(method && { method })
      })

      if (data.ethAddress) {
        identifyUser(data.ethAddress)
      }
    },
    []
  )

  const trackClick = useCallback((action: ClickEvents, additionalData?: ClickData) => {
    trackEvent(TrackingEvents.CLICK, {
      action,
      ...additionalData
    })
  }, [])

  const trackAvatarEditSuccess = useCallback(
    (data: { ethAddress?: string; isGuest: boolean; profile: string; avatarShape?: AvatarShape; skipped?: boolean }) => {
      trackEvent(TrackingEvents.AVATAR_EDIT_SUCCESS, {
        // eth_address (snake_case) to match LOGIN_SUCCESS / TERMS_OF_SERVICE_SUCCESS, so
        // cross-event address queries in Segment include avatar-edit events.
        eth_address: data.ethAddress,
        is_guest: data.isGuest,
        profile: data.profile,
        avatar_shape: data.avatarShape,
        skipped: data.skipped
      })
    },
    []
  )

  const trackTermsOfServiceSuccess = useCallback((data: { ethAddress?: string; isGuest: boolean; email?: string; name: string }) => {
    trackEvent(TrackingEvents.TERMS_OF_SERVICE_SUCCESS, {
      eth_address: data.ethAddress,

      is_guest: data.isGuest,
      email: data.email,
      name: data.name
    })
  }, [])

  const trackStartAddingName = useCallback(() => {
    trackEvent(TrackingEvents.START_ADDING_NAME)
  }, [])

  const trackStartAddingEmail = useCallback(() => {
    trackEvent(TrackingEvents.START_ADDING_EMAIL)
  }, [])

  const trackCheckTermsOfService = useCallback(() => {
    trackEvent(TrackingEvents.CHECK_TERMS_OF_SERVICE)
  }, [])

  const trackAvatarCustomizationStep = useCallback((data: { step: number; stepName: string }) => {
    trackEvent(TrackingEvents.AVATAR_CUSTOMIZATION_STEP, {
      step: data.step,
      step_name: data.stepName
    })
  }, [])

  const trackWebGPUSupportCheck = useCallback((data: { supported: boolean }) => {
    trackEvent(TrackingEvents.WEBGPU_SUPPORT_CHECK, data)
  }, [])

  const trackGuestLogin = useCallback(async () => {
    trackLoginClick({ type: 'guest' })
    await wait(TRACKING_DELAY)
  }, [trackLoginClick])

  return {
    trackAvatarCustomizationStep,
    trackAvatarEditSuccess,
    trackCheckTermsOfService,
    trackClick,
    trackGuestLogin,
    trackLoginClick,
    trackLoginSuccess,
    trackStartAddingEmail,
    trackStartAddingName,
    trackTermsOfServiceSuccess,
    trackWebGPUSupportCheck
  }
}
