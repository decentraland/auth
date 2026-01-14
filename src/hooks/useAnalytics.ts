/* eslint-disable @typescript-eslint/naming-convention */
import { useCallback } from 'react'
import { AvatarShape } from '../components/Pages/AvatarSetupPage/AvatarSetupPage.types'
import { TrackingEvents, ClickEvents, ConnectionType } from '../modules/analytics/types'
import { TRACKING_DELAY } from '../shared/constants'
import { wait } from '../shared/time'
import { trackEvent, trackWithDelay, identifyUser } from '../shared/utils/analytics'

interface ClickData {
  method?: string
  type?: string
  [key: string]: string | number | boolean | undefined
}

export const useAnalytics = () => {
  const trackLoginClick = useCallback((data: { method?: string; type: ConnectionType | string }) => {
    trackEvent(TrackingEvents.LOGIN_CLICK, data)
  }, [])

  const trackLoginSuccess = useCallback(async (data: { ethAddress?: string; type: ConnectionType | string }) => {
    await trackWithDelay(TrackingEvents.LOGIN_SUCCESS, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      eth_address: data.ethAddress,
      type: data.type
    })

    if (data.ethAddress) {
      identifyUser(data.ethAddress)
    }
  }, [])

  const trackClick = useCallback((action: ClickEvents, additionalData?: ClickData) => {
    trackEvent(TrackingEvents.CLICK, {
      action,
      ...additionalData
    })
  }, [])

  const trackAvatarEditSuccess = useCallback(
    (data: { ethAddress?: string; isGuest: boolean; profile: string; avatarShape?: AvatarShape }) => {
      trackEvent(TrackingEvents.AVATAR_EDIT_SUCCESS, {
        ethAddress: data.ethAddress,
        is_guest: data.isGuest,
        profile: data.profile,
        avatar_shape: data.avatarShape
      })
    },
    []
  )

  const trackTermsOfServiceSuccess = useCallback((data: { ethAddress?: string; isGuest: boolean; email?: string; name: string }) => {
    trackEvent(TrackingEvents.TERMS_OF_SERVICE_SUCCESS, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      eth_address: data.ethAddress,
      // eslint-disable-next-line @typescript-eslint/naming-convention
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

  const trackWebGPUSupportCheck = useCallback((data: { supported: boolean }) => {
    trackEvent(TrackingEvents.WEBGPU_SUPPORT_CHECK, data)
  }, [])

  const trackGuestLogin = useCallback(async () => {
    trackLoginClick({ type: 'guest' })
    await wait(TRACKING_DELAY)
  }, [trackLoginClick])

  return {
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
