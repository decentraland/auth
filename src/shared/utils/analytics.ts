import { getAnalytics } from '../../modules/analytics/segment'
import { TrackingEvents } from '../../modules/analytics/types'
import { TRACKING_DELAY } from '../constants'
import { getMobileSession } from '../mobile'
import { wait } from '../time'
import { TrackingData } from './errorHandler.types'

const trackEvent = (event: TrackingEvents, data?: TrackingData) => {
  const session = getMobileSession()
  getAnalytics()?.track(event, {
    ...data,
    ...(session && { isMobile: true, sessionId: session.s })
  })
}

const trackWithDelay = async (event: TrackingEvents, data?: TrackingData) => {
  trackEvent(event, data)
  await wait(TRACKING_DELAY)
}

const identifyUser = (ethAddress: string) => {
  getAnalytics()?.identify({ ethAddress })
}

export { identifyUser, trackEvent, trackWithDelay }
