import { io } from 'socket.io-client'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { trackEvent } from '../utils/analytics'
import { handleError } from '../utils/errorHandler'
import { DifferentSenderError, ExpiredRequestError, RequestNotFoundError, IpValidationError } from './errors'
import { OutcomeError, RecoverResponse, ValidationResponse } from './types'

export const createAuthServerWsClient = (authServerUrl?: string) => {
  const url = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const request = async <T>(
    event: string,
    message: { requestId: string; sender?: string; result?: any; error?: OutcomeError }
  ): Promise<T> => {
    const socket = io(url)

    await new Promise<void>(resolve => {
      socket.on('connect', resolve)
    })

    const response = await socket.emitWithAck(event, message)

    // Close client, we don't need it anymore
    socket.close()

    if (response.error?.includes('not found')) {
      throw new RequestNotFoundError(message.requestId)
    } else if (response.error?.includes('has expired')) {
      throw new ExpiredRequestError(message.requestId)
    } else if (response.error?.includes('IP validation failed')) {
      throw new IpValidationError(message.requestId, response.error)
    } else if (response.error) {
      throw new Error(response.error)
    }

    return response
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: any): Promise<void> => {
    try {
      await request<void>('outcome', {
        requestId,
        sender,
        result
      })
    } catch (e) {
      handleError(e, 'Error sending outcome')
      throw e
    }
  }

  const sendFailedOutcome = async (requestId: string, sender: string, error: OutcomeError): Promise<void> => {
    try {
      await request<void>('outcome', {
        requestId,
        sender,
        error
      })
    } catch (e) {
      handleError(e, 'Error sending outcome')
      throw e
    }
  }

  const recover = async (requestId: string, signerAddress: string): Promise<RecoverResponse> => {
    let response: RecoverResponse | undefined

    try {
      response = await request<RecoverResponse>('recover', { requestId })

      if (response.error) {
        throw new Error(response.error)
      }

      // If the sender defined in the request is different than the one that is connected, show an error.
      if (response.sender && response.sender !== signerAddress.toLowerCase()) {
        throw new DifferentSenderError(signerAddress, response.sender)
      }

      if (response.expiration && new Date(response.expiration) < new Date()) {
        throw new ExpiredRequestError(requestId, response.expiration)
      }

      switch (response.method) {
        case 'dcl_personal_sign':
          trackEvent(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.VERIFY_SIGN_IN,
            browserTime: Date.now(),
            requestTime: new Date(response.expiration).getTime(),
            requestType: response?.method
          })
          break
        case 'eth_sendTransaction':
          trackEvent(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: response.method
          })
          break
        default:
          trackEvent(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: response.method
          })
      }

      return response
    } catch (e) {
      handleError(e, 'Error recovering request', {
        trackingData: {
          browserTime: Date.now(),
          requestType: response?.method ?? 'Unknown'
        },
        trackingEvent: TrackingEvents.REQUEST_LOADING_ERROR
      })
      throw e
    }
  }

  const notifyRequestNeedsValidation = async (requestId: string): Promise<void> => {
    try {
      await request<ValidationResponse>('request-validation-status', { requestId })
    } catch (e) {
      handleError(e, 'Error notifying request needs validation')
      throw e
    }
  }

  return { recover, sendSuccessfulOutcome, sendFailedOutcome, notifyRequestNeedsValidation }
}
