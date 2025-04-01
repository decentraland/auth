import { captureException } from '@sentry/react'
import { io } from 'socket.io-client'
import { getAnalytics } from '../../modules/analytics/segment'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { DifferentSenderError, ExpiredRequestError, OutcomeError } from './errors'

export type RecoverResponse = {
  sender: string
  expiration: string
  method: string
  code?: string
  error?: string
  params?: any[]
}

export type OutcomeResponse = {
  error?: string
}

export const createAuthServerClient = (authServerUrl?: string) => {
  const url = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const request = async <T>(event: string, message: any): Promise<T> => {
    const socket = io(url)

    await new Promise<void>(resolve => {
      socket.on('connect', resolve)
    })

    const response = await socket.emitWithAck(event, message)

    // Close client, we don't need it anymore
    socket.close()

    if (response.error) {
      throw new Error(response.error)
    }

    return response
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: any): Promise<void> => {
    try {
      const response = await request<OutcomeResponse>('outcome', {
        requestId,
        sender,
        result
      })

      if (response.error) {
        throw new OutcomeError(response.error)
      }
    } catch (e) {
      console.error('Error sending outcome', e)
      captureException(e)
      throw e
    }
  }

  const sendFailedOutcome = async (requestId: string, sender: string, error: { code: number; message: string }): Promise<void> => {
    try {
      const response = await request<OutcomeResponse>('outcome', {
        requestId,
        sender,
        error
      })

      if (response.error) {
        throw new OutcomeError(response.error)
      }
    } catch (e) {
      console.error('Error sending outcome', e)
      captureException(e)
      throw e
    }
  }

  const recover = async (requestId: string, signerAddress: string) => {
    let response: RecoverResponse | undefined

    try {
      response = await request<RecoverResponse>('recover', { requestId })

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
        requestType: response?.method ?? 'Unknown'
      })
      throw e
    }
  }

  return { recover, sendSuccessfulOutcome, sendFailedOutcome }
}
