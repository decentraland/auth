import { captureException } from '@sentry/react'
import { getAnalytics } from '../../modules/analytics/segment'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { isErrorWithMessage } from '../errors'
import { DifferentSenderError, ExpiredRequestError, RequestNotFoundError } from './errors'
import { OutcomeError, RecoverResponse } from './types'
export const createAuthServerHttpClient = (authServerUrl?: string) => {
  const baseUrl = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const extractError = async (response: Response, requestId: string) => {
    let data: { error?: string }
    try {
      data = await response.json()
    } catch (error) {
      throw new Error('Unknown error')
    }

    if (data.error?.includes('not found')) {
      throw new RequestNotFoundError(requestId)
    } else if (data.error?.includes('has expired')) {
      throw new ExpiredRequestError(requestId)
    } else if (data.error) {
      throw new Error(data.error)
    }

    throw new Error('Unknown error')
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: any): Promise<void> => {
    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId + '/outcome', {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender,
          result
        })
      })

      if (!response.ok) {
        await extractError(response, requestId)
      }
    } catch (e) {
      console.error('Error sending outcome', e)
      captureException(e)
      throw e
    }
  }

  const sendFailedOutcome = async (requestId: string, sender: string, error: OutcomeError): Promise<void> => {
    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId + '/outcome', {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender,
          error
        })
      })

      if (!response.ok) {
        await extractError(response, requestId)
      }
    } catch (e) {
      console.error('Error sending outcome', e)
      captureException(e)
      throw e
    }
  }

  const recover = async (requestId: string, signerAddress: string): Promise<RecoverResponse> => {
    let recoverResponse: RecoverResponse | undefined

    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId, {
        method: 'GET'
      })

      if (!response.ok) {
        await extractError(response, requestId)
      }

      const recoverResponse = await response.json()

      // If the sender defined in the request is different than the one that is connected, show an error.
      if (recoverResponse.sender && recoverResponse.sender !== signerAddress.toLowerCase()) {
        throw new DifferentSenderError(signerAddress, recoverResponse.sender)
      }

      if (recoverResponse.expiration && new Date(recoverResponse.expiration) < new Date()) {
        throw new ExpiredRequestError(requestId, recoverResponse.expiration)
      }

      switch (recoverResponse.method) {
        case 'dcl_personal_sign':
          getAnalytics()?.track(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.VERIFY_SIGN_IN,
            browserTime: Date.now(),
            requestTime: new Date(recoverResponse.expiration).getTime(),
            requestType: recoverResponse?.method
          })
          break
        case 'eth_sendTransaction':
          getAnalytics()?.track(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: recoverResponse.method
          })
          break
        default:
          getAnalytics()?.track(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: recoverResponse.method
          })
      }

      return recoverResponse
    } catch (e) {
      console.error('Error recovering request', e)
      captureException(e)
      getAnalytics()?.track(TrackingEvents.REQUEST_LOADING_ERROR, {
        browserTime: Date.now(),
        requestType: recoverResponse?.method ?? 'Unknown',
        error: isErrorWithMessage(e) ? e.message : 'Unknown error'
      })
      throw e
    }
  }

  const notifyRequestNeedsValidation = async (requestId: string) => {
    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId + '/validation', {
        method: 'POST'
      })

      if (!response.ok) {
        await extractError(response, requestId)
      }
    } catch (e) {
      console.error('Error notifying request needs validation', e)
      captureException(e)
      throw e
    }
  }

  return { recover, sendSuccessfulOutcome, sendFailedOutcome, notifyRequestNeedsValidation }
}
