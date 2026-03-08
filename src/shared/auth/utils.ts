import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { trackEvent } from '../utils/analytics'
import { handleError } from '../utils/errorHandler'
import { DifferentSenderError, ExpiredRequestError, IpValidationError, RequestFulfilledError, RequestNotFoundError } from './errors'
import { RecoverResponse } from './types'

/**
 * Parses an error string from the auth server and throws the appropriate typed error.
 */
const throwAuthServerError = (error: string, requestId: string): never => {
  if (error.includes('already been fulfilled')) {
    throw new RequestFulfilledError(requestId)
  } else if (error.includes('not found')) {
    throw new RequestNotFoundError(requestId)
  } else if (error.includes('has expired')) {
    throw new ExpiredRequestError(requestId)
  } else if (error.includes('IP validation failed')) {
    throw new IpValidationError(requestId, error)
  }
  throw new Error(error)
}

/**
 * Validates a recovered request: checks sender mismatch and expiration.
 */
const validateRecoverResponse = (response: RecoverResponse, signerAddress: string, requestId: string) => {
  if (response.sender && response.sender !== signerAddress.toLowerCase()) {
    throw new DifferentSenderError(signerAddress, response.sender)
  }

  if (response.expiration && new Date(response.expiration) < new Date()) {
    throw new ExpiredRequestError(requestId, response.expiration)
  }
}

/**
 * Tracks the appropriate analytics event based on the recover response method.
 */
const trackRecoverMethod = (response: RecoverResponse, isDeepLinkFlow: boolean) => {
  switch (response.method) {
    case 'dcl_personal_sign':
      trackEvent(TrackingEvents.REQUEST_INTERACTION, {
        type: isDeepLinkFlow ? RequestInteractionType.DEEP_LINK_SIGN_IN : RequestInteractionType.VERIFY_SIGN_IN,
        browserTime: Date.now(),
        requestTime: response.expiration ? new Date(response.expiration).getTime() : undefined,
        requestType: response.method
      })
      break
    case 'eth_sendTransaction':
    default:
      trackEvent(TrackingEvents.REQUEST_INTERACTION, {
        type: RequestInteractionType.WALLET_INTERACTION,
        requestType: response.method
      })
  }
}

/**
 * Handles error reporting for recover flow, excluding fulfilled requests from Sentry.
 */
const handleRecoverError = (e: unknown, response: RecoverResponse | undefined) => {
  if (!(e instanceof RequestFulfilledError)) {
    handleError(e, 'Error recovering request', {
      trackingData: {
        browserTime: Date.now(),
        requestType: response?.method ?? 'Unknown'
      },
      trackingEvent: TrackingEvents.REQUEST_LOADING_ERROR
    })
  }
}

export { throwAuthServerError, validateRecoverResponse, trackRecoverMethod, handleRecoverError }
