import { AuthIdentity } from '@dcl/crypto'
import signedFetch from 'decentraland-crypto-fetch'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { trackEvent } from '../utils/analytics'
import { handleError } from '../utils/errorHandler'
import { DifferentSenderError, ExpiredRequestError, RequestNotFoundError, IpValidationError } from './errors'
import { IdentityResponse, OutcomeError, OutcomeResponse, RecoverResponse } from './types'
export const createAuthServerHttpClient = (authServerUrl?: string) => {
  const baseUrl = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const getResponseCorrelationIds = (response: Response) => {
    // Rationale: backend logs often include request/trace identifiers in headers.
    // Adding them to Sentry makes it much easier to correlate a frontend error with server-side logs.
    const headers = (response as unknown as { headers?: { get?: (key: string) => string | null } }).headers
    return {
      traceparent: headers?.get?.('traceparent') ?? undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      x_request_id: headers?.get?.('x-request-id') ?? undefined
    }
  }

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
    } else if (data.error?.includes('IP validation failed')) {
      throw new IpValidationError(requestId, data.error)
    } else if (data.error) {
      throw new Error(data.error)
    }

    throw new Error('Unknown error')
  }

  const sendSuccessfulOutcome = async (requestId: string, sender: string, result: unknown): Promise<OutcomeResponse> => {
    let responseCorrelationIds: ReturnType<typeof getResponseCorrelationIds> | undefined
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

      responseCorrelationIds = getResponseCorrelationIds(response)

      if (!response.ok) {
        await extractError(response, requestId)
      }

      trackEvent(TrackingEvents.REQUEST_OUTCOME_SUCCESS, {
        type: 'success',
        method: 'outcome_send'
      })

      return {}
    } catch (e) {
      handleError(e, 'Error sending outcome', {
        sentryExtra: {
          requestId,
          ...responseCorrelationIds
        }
      })
      throw e
    }
  }

  const postIdentity = async (identity: AuthIdentity): Promise<IdentityResponse> => {
    try {
      const response = await signedFetch(baseUrl + '/identities', {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identity }),
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
    let responseCorrelationIds: ReturnType<typeof getResponseCorrelationIds> | undefined
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

      responseCorrelationIds = getResponseCorrelationIds(response)

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
      handleError(e, 'Error sending outcome', {
        sentryExtra: {
          requestId,
          ...responseCorrelationIds
        }
      })
      throw e
    }
  }

  const recover = async (requestId: string, signerAddress: string, isDeepLinkFlow = false): Promise<RecoverResponse> => {
    let recoverResponse: RecoverResponse | undefined
    let responseCorrelationIds: ReturnType<typeof getResponseCorrelationIds> | undefined

    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId, {
        method: 'GET'
      })

      responseCorrelationIds = getResponseCorrelationIds(response)

      if (!response.ok) {
        await extractError(response, requestId)
      }

      recoverResponse = await response.json()

      if (!recoverResponse) {
        // Defensive guard + type narrowing. If the server returns an empty body we prefer failing explicitly.
        throw new Error('Recover response is empty')
      }

      // If the sender defined in the request is different than the one that is connected, show an error.
      if (recoverResponse.sender && recoverResponse.sender !== signerAddress.toLowerCase()) {
        throw new DifferentSenderError(signerAddress, recoverResponse.sender)
      }

      if (recoverResponse.expiration && new Date(recoverResponse.expiration) < new Date()) {
        throw new ExpiredRequestError(requestId, recoverResponse.expiration)
      }

      switch (recoverResponse.method) {
        case 'dcl_personal_sign':
          trackEvent(TrackingEvents.REQUEST_INTERACTION, {
            type: isDeepLinkFlow ? RequestInteractionType.DEEP_LINK_SIGN_IN : RequestInteractionType.VERIFY_SIGN_IN,
            browserTime: Date.now(),
            requestType: recoverResponse?.method
          })
          break
        case 'eth_sendTransaction':
          trackEvent(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: recoverResponse.method
          })
          break
        default:
          trackEvent(TrackingEvents.REQUEST_INTERACTION, {
            type: RequestInteractionType.WALLET_INTERACTION,
            requestType: recoverResponse.method
          })
      }

      return recoverResponse
    } catch (e) {
      handleError(e, 'Error recovering request', {
        sentryExtra: {
          requestId,
          ...responseCorrelationIds
        },
        trackingData: {
          browserTime: Date.now(),
          requestType: recoverResponse?.method ?? 'Unknown'
        },
        trackingEvent: TrackingEvents.REQUEST_LOADING_ERROR
      })
      throw e
    }
  }

  const notifyRequestNeedsValidation = async (requestId: string) => {
    let responseCorrelationIds: ReturnType<typeof getResponseCorrelationIds> | undefined
    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId + '/validation', {
        method: 'POST'
      })

      responseCorrelationIds = getResponseCorrelationIds(response)

      if (!response.ok) {
        await extractError(response, requestId)
      }
    } catch (e) {
      handleError(e, 'Error notifying request needs validation', {
        sentryExtra: {
          requestId,
          ...responseCorrelationIds
        }
      })
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
