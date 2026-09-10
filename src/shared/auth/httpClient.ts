import { AuthIdentity } from '@dcl/crypto'
import signedFetch from 'decentraland-crypto-fetch'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { isErrorWithMessage } from '../errors'
import { readTextWithCap } from '../http'
import { trackEvent } from '../utils/analytics'
import { handleError } from '../utils/errorHandler'
import {
  DifferentSenderError,
  ExpiredRequestError,
  RequestFulfilledError,
  RequestNotFoundError,
  SimulationUnavailableError
} from './errors'
import type { SimulationRejectionCode } from './errors'
import { assertRecoverResponseIsCanonical } from './recoverResponse'
import {
  assertMethodIsAllowed,
  assertRequestIsNotImpersonatingSignIn,
  assertSignatureParamsAreCanonical,
  assertTransactionParamsAreCanonical
} from './signMethodGuard'
import { parseSimulationResponse } from './simulationResponse'
import { IdentityResponse, OutcomeError, OutcomeResponse, RecoverResponse, SimulationRequestBody, SimulationResponseBody } from './types'

const SIMULATION_TIMEOUT_MS = 10_000
export const createAuthServerHttpClient = (authServerUrl?: string) => {
  const baseUrl = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const extractError = async (response: Response, requestId: string) => {
    let data: { error?: string }
    try {
      data = await response.json()
    } catch {
      throw new Error('Unknown error')
    }

    // "already been fulfilled" (the outcome was delivered) and "already has a response" (an
    // outcome is stored, pending delivery) both mean the request was already answered. Treat them
    // alike: there is nothing left to do, and retrying only re-sends an outcome the server keeps
    // rejecting. Without the second string it degrades to a generic error whose "Try Again"
    // reopens the client for a request that is already done.
    if (data.error?.includes('already been fulfilled') || data.error?.includes('already has a response')) {
      throw new RequestFulfilledError(requestId)
    } else if (data.error?.includes('not found')) {
      throw new RequestNotFoundError(requestId)
    } else if (data.error?.includes('has expired')) {
      throw new ExpiredRequestError(requestId)
    } else if (data.error) {
      throw new Error(data.error)
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

  const postIdentity = async (
    identity: AuthIdentity,
    // `authRequestId` is the deep-link handoff's correlation id (the route UUID); forwarded onto
    // the success event so a login can be tied to the instance that requested it in analytics.
    opts: { isMobile?: boolean; authRequestId?: string | null } = { isMobile: false }
  ): Promise<IdentityResponse> => {
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
        type: 'success',
        ...(opts.authRequestId ? { authRequestId: opts.authRequestId } : {})
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

  const recover = async (requestId: string, signerAddress: string): Promise<RecoverResponse> => {
    let recoverResponse: RecoverResponse | undefined

    try {
      const response = await fetch(baseUrl + '/v2/requests/' + requestId, {
        method: 'GET'
      })

      if (!response.ok) {
        await extractError(response, requestId)
      }

      // Checked, not cast: `sender` and `expiration` are the two fields the checks below are made of, and
      // both used to be read only when present, so a response without them was read as a request bound to
      // nobody and expiring never (see assertRecoverResponseIsCanonical).
      const body: unknown = await response.json()
      assertRecoverResponseIsCanonical(body, requestId)
      recoverResponse = body

      // If the sender defined in the request is different than the one that is connected, show an
      // error. Compare both sides case-insensitively — the server is not guaranteed to lowercase
      // `sender`, and a checksummed address must still match the connected (lowercased) account.
      if (recoverResponse.sender.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new DifferentSenderError(signerAddress, recoverResponse.sender)
      }

      if (new Date(recoverResponse.expiration) <= new Date()) {
        throw new ExpiredRequestError(requestId, recoverResponse.expiration)
      }

      // Reject methods the auth site does not support (e.g. the dangerous legacy `eth_sign`)
      // before anything is forwarded to the wallet, and pin the method to its canonical EIP-1193
      // spelling. Everything downstream dispatches case-SENSITIVELY (RequestPage switches on
      // `case 'eth_sendTransaction'` and forwards the method verbatim to the wallet), so an
      // oddly-cased method that passed the case-insensitive gate would otherwise miss the
      // transaction path entirely and dead-end at the wallet.
      recoverResponse.method = assertMethodIsAllowed(recoverResponse.method)

      // Reject requests that ask the wallet to sign a Decentraland identity-authorization
      // payload, which would yield an auth chain that impersonates the user.
      assertRequestIsNotImpersonatingSignIn(recoverResponse.method, recoverResponse.params)

      // Reject params the preview and the wallet would read from different positions.
      assertSignatureParamsAreCanonical(recoverResponse.method, recoverResponse.params, signerAddress)

      // Reject transaction params the preview cannot read or that the wallet would not execute as shown.
      assertTransactionParamsAreCanonical(recoverResponse.method, recoverResponse.params)

      trackEvent(TrackingEvents.REQUEST_INTERACTION, {
        type: RequestInteractionType.WALLET_INTERACTION,
        requestType: recoverResponse.method
      })

      return recoverResponse
    } catch (e) {
      handleError(e, 'Error recovering request', {
        trackingData: {
          browserTime: Date.now(),
          requestType: recoverResponse?.method ?? 'Unknown'
        },
        trackingEvent: TrackingEvents.REQUEST_LOADING_ERROR
      })
      throw e
    }
  }

  /**
   * Asks the auth server to simulate a transaction (or meta-transaction inner call) and
   * return a normalized summary of asset transfers and approvals. This is best-effort and
   * fails open: any non-200 response, timeout, or network error throws
   * SimulationUnavailableError, which the UI renders as "details unavailable" rather than
   * blocking the approval. Deliberately not routed through handleError/Sentry.
   */
  // A rejection body is a short object; anything larger than this is not one and is not read further.
  const MAX_REJECTION_BODY_BYTES = 4 * 1024

  /**
   * Upper bound on a successful summary. `parseSimulationResponse` bounds how many rows the review will
   * take, but it can only do that once the body has been buffered and parsed — and the body is derived
   * from calldata the requester chose, so its size is theirs to pick. Read under a cap first, and an
   * oversized answer costs the page nothing past the bytes read.
   *
   * 2 MB against what a conforming server can send: every collection is bounded (1,024 movements, 1,024
   * permissions, 512 events, 512 balance rows), which projects to ~1.04 MB with realistic field values.
   * So this cannot refuse an answer the DTO parser would have accepted — anything past it was going to be
   * refused for its row counts a moment later anyway.
   */
  const MAX_SIMULATION_BODY_BYTES = 2 * 1024 * 1024

  const REJECTION_CODES: ReadonlySet<string> = new Set<SimulationRejectionCode>([
    'invalid_request',
    'upstream_rejected',
    'quota_exceeded',
    'upstream_rate_limited'
  ])

  const readRejectionCode = async (response: Response): Promise<SimulationRejectionCode | undefined> => {
    try {
      const body: unknown = JSON.parse(await readTextWithCap(response, MAX_REJECTION_BODY_BYTES))
      const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
      return typeof code === 'string' && REJECTION_CODES.has(code) ? (code as SimulationRejectionCode) : undefined
    } catch {
      return undefined
    }
  }

  const simulateTransaction = async (body: SimulationRequestBody): Promise<SimulationResponseBody> => {
    let response: Response
    try {
      response = await fetch(baseUrl + '/simulations', {
        method: 'POST',
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SIMULATION_TIMEOUT_MS)
      })
    } catch (e) {
      throw new SimulationUnavailableError(isErrorWithMessage(e) ? e.message : undefined)
    }

    if (!response.ok) {
      // The server says why in the body (`code`), so a caller can tell the request being refused from the
      // provider refusing it; a body that cannot be read leaves the code unknown.
      throw new SimulationUnavailableError(`status ${response.status}`, response.status, await readRejectionCode(response))
    }

    // Read under the cap, then parse: `response.json()` would buffer and parse the whole body before
    // anything could refuse it (see MAX_SIMULATION_BODY_BYTES). An overrun degrades like an outage, which
    // is the fallback the review already handles.
    let parsed: unknown
    try {
      parsed = JSON.parse(await readTextWithCap(response, MAX_SIMULATION_BODY_BYTES))
    } catch (e) {
      throw new SimulationUnavailableError(isErrorWithMessage(e) ? e.message : 'invalid response')
    }
    // Checked, not cast: the review reads these rows directly, so a body that does not honour the DTO must
    // degrade like an outage rather than reach a consumer that assumes a field is there (see
    // parseSimulationResponse).
    const result = parseSimulationResponse(parsed)
    if (!result) {
      throw new SimulationUnavailableError('the response is not a simulation summary')
    }
    return result
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

  return { recover, sendSuccessfulOutcome, sendFailedOutcome, checkHealth, postIdentity, simulateTransaction }
}
