import { getAnalytics } from '../../modules/analytics/segment'
import { TrackingEvents } from '../../modules/analytics/types'
import { TRACKING_DELAY } from '../constants'
import { wait } from '../time'
import { TrackingData } from './errorHandler.types'

const trackEvent = (event: TrackingEvents, data?: TrackingData) => {
  getAnalytics()?.track(event, data)
}

const trackWithDelay = async (event: TrackingEvents, data?: TrackingData) => {
  trackEvent(event, data)
  await wait(TRACKING_DELAY)
}

const identifyUser = (ethAddress: string) => {
  getAnalytics()?.identify({ ethAddress })
}

export { identifyUser, trackEvent, trackWithDelay }
