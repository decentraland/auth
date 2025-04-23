import { captureException } from '@sentry/react'
import { io } from 'socket.io-client'
import { getAnalytics } from '../../modules/analytics/segment'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { isErrorWithMessage } from '../errors'
import { DifferentSenderError, ExpiredRequestError, RequestNotFoundError } from './errors'
import { OutcomeError, OutcomeResponse, RecoverResponse, ValidationResponse } from './types'

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
    } else if (response.error) {
      throw new Error(response.error)
    }

    return response
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: any): Promise<void> => {
    try {
      await request<OutcomeResponse>('outcome', {
        requestId,
        sender,
        result
      })
    } catch (e) {
      console.error('Error sending outcome', e)
      captureException(e)
      throw e
    }
  }

  const sendFailedOutcome = async (requestId: string, sender: string, error: OutcomeError): Promise<void> => {
    try {
      await request<OutcomeResponse>('outcome', {
        requestId,
        sender,
        error
      })
    } catch (e) {
      console.error('Error sending outcome', e)
      captureException(e)
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
          getAnalytics()?.track(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.VERIFY_SIGN_IN,
            browserTime: Date.now(),
            requestTime: new Date(response.expiration).getTime(),
            requestType: response?.method
          })
          break
        case 'eth_sendTransaction':
          getAnalytics()?.track(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: response.method
          })
          break
        default:
          getAnalytics()?.track(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: response.method
          })
      }

      return response
    } catch (e) {
      console.error('Error recovering request', e)
      captureException(e)
      getAnalytics()?.track(TrackingEvents.REQUEST_LOADING_ERROR, {
        browserTime: Date.now(),
        requestType: response?.method ?? 'Unknown',
        error: isErrorWithMessage(e) ? e.message : 'Unknown error'
      })
      throw e
    }
  }

  const notifyRequestNeedsValidation = async (requestId: string): Promise<void> => {
    try {
      await request<ValidationResponse>('request-validation-status', { requestId })
    } catch (e) {
      console.error('Error notifying request needs validation', e)
      captureException(e)
      throw e
    }
  }

  return { recover, sendSuccessfulOutcome, sendFailedOutcome, notifyRequestNeedsValidation }
}
