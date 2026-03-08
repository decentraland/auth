import { io } from 'socket.io-client'
import { config } from '../../modules/config'
import { handleError } from '../utils/errorHandler'
import { OutcomeError, OutcomeResponse, RecoverResponse, ValidationResponse } from './types'
import { handleRecoverError, throwAuthServerError, trackRecoverMethod, validateRecoverResponse } from './utils'

export const createAuthServerWsClient = (authServerUrl?: string) => {
  const url = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const request = async <T>(
    event: string,
    message: { requestId: string; sender?: string; result?: unknown; error?: OutcomeError }
  ): Promise<T> => {
    const socket = io(url)

    await new Promise<void>(resolve => {
      socket.on('connect', resolve)
    })

    const response = await socket.emitWithAck(event, message)

    // Close client, we don't need it anymore
    socket.close()

    if (response.error) {
      throwAuthServerError(response.error, message.requestId)
    }

    return response
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: unknown): Promise<OutcomeResponse> => {
    try {
      return await request<OutcomeResponse>('outcome', {
        requestId,
        sender,
        result
      })
    } catch (e) {
      handleError(e, 'Error sending outcome')
      throw e
    }
  }

  const sendFailedOutcome = async (requestId: string, sender: string, error: OutcomeError): Promise<OutcomeResponse> => {
    try {
      return await request<OutcomeResponse>('outcome', {
        requestId,
        sender,
        error
      })
    } catch (e) {
      handleError(e, 'Error sending outcome')
      throw e
    }
  }

  const recover = async (requestId: string, signerAddress: string, isDeepLinkFlow = false): Promise<RecoverResponse> => {
    let response: RecoverResponse | undefined

    try {
      response = await request<RecoverResponse>('recover', { requestId })

      if (response.error) {
        throw new Error(response.error)
      }

      validateRecoverResponse(response, signerAddress, requestId)
      trackRecoverMethod(response, isDeepLinkFlow)

      return response
    } catch (e) {
      handleRecoverError(e, response)
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
