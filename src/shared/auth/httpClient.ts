import { AuthIdentity } from '@dcl/crypto'
import signedFetch from 'decentraland-crypto-fetch'
import { TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { trackEvent } from '../utils/analytics'
import { handleError } from '../utils/errorHandler'
import { IdentityResponse, OutcomeError, OutcomeResponse, RecoverResponse } from './types'
import { handleRecoverError, throwAuthServerError, trackRecoverMethod, validateRecoverResponse } from './utils'
export const createAuthServerHttpClient = (authServerUrl?: string) => {
  const baseUrl = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const extractError = async (response: Response, requestId: string) => {
    let data: { error?: string }
    try {
      data = await response.json()
    } catch {
      throw new Error('Unknown error')
    }

    if (data.error) {
      throwAuthServerError(data.error, requestId)
    }

    throw new Error('Unknown error')
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: unknown): Promise<OutcomeResponse> => {
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

      trackEvent(TrackingEvents.REQUEST_OUTCOME_SUCCESS, {
        type: 'success',
        method: 'outcome_send'
      })

      return {}
    } catch (e) {
      handleError(e, 'Error sending outcome')
      throw e
    }
  }

  const postIdentity = async (identity: AuthIdentity, opts: { isMobile?: boolean } = { isMobile: false }): Promise<IdentityResponse> => {
    try {
      const response = await signedFetch(baseUrl + '/identities', {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identity, isMobile: opts.isMobile }),
        identity
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create identity')
      }

      const data = await response.json()

      trackEvent(TrackingEvents.DEEP_LINK_AUTH_SUCCESS, {
        type: 'success'
      })

      return data
    } catch (e) {
      handleError(e, 'Error creating identity')
      throw e
    }
  }

  const sendFailedOutcome = async (requestId: string, sender: string, error: OutcomeError): Promise<OutcomeResponse> => {
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

      trackEvent(TrackingEvents.REQUEST_OUTCOME_FAILED, {
        type: 'failed',
        method: 'outcome_send',
        error: error.message
      })

      return {}
    } catch (e) {
      handleError(e, 'Error sending outcome')
      throw e
    }
  }

  const recover = async (requestId: string, signerAddress: string, isDeepLinkFlow = false): Promise<RecoverResponse> => {
    let recoverResponse: RecoverResponse | undefined

    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId, {
        method: 'GET'
      })

      if (!response.ok) {
        await extractError(response, requestId)
      }

      recoverResponse = await response.json()

      validateRecoverResponse(recoverResponse!, signerAddress, requestId)
      trackRecoverMethod(recoverResponse!, isDeepLinkFlow)

      return recoverResponse!
    } catch (e) {
      handleRecoverError(e, recoverResponse)
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
      handleError(e, 'Error notifying request needs validation')
      throw e
    }
  }

  const checkHealth = async (): Promise<{ timestamp: number }> => {
    try {
      const response = await fetch(baseUrl + '/health/live', {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (e) {
      handleError(e, 'Error checking auth server health')
      throw e
    }
  }

  return { recover, sendSuccessfulOutcome, sendFailedOutcome, notifyRequestNeedsValidation, checkHealth, postIdentity }
}
