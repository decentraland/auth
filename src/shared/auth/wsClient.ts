import { io } from 'socket.io-client'
import { RequestInteractionType, TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import { trackEvent } from '../utils/analytics'
import { handleError } from '../utils/errorHandler'
import { DifferentSenderError, ExpiredRequestError, IpValidationError, RequestFulfilledError, RequestNotFoundError } from './errors'
import { assertMethodIsAllowed, assertRequestIsNotImpersonatingSignIn } from './signMethodGuard'
import { OutcomeError, OutcomeResponse, RecoverResponse, ValidationResponse } from './types'

// Fail fast instead of hanging forever if the auth server is unreachable or never acks.
const CONNECT_TIMEOUT_MS = 15000
const ACK_TIMEOUT_MS = 30000

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

export const createAuthServerWsClient = (authServerUrl?: string) => {
  const url = authServerUrl ?? config.get('AUTH_SERVER_URL')

  const request = async <T>(
    event: string,
    message: { requestId: string; sender?: string; result?: unknown; error?: OutcomeError }
  ): Promise<T> => {
    const socket = io(url)

    try {
      // Reject (rather than hang) if the connection can't be established or times out.
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          socket.on('connect', () => {
            // Detach the error handler once connected so a later reconnection error
            // (before socket.close) can't call reject on an already-settled promise.
            socket.off('connect_error', reject)
            resolve()
          })
          socket.on('connect_error', reject)
        }),
        CONNECT_TIMEOUT_MS,
        'Timed out connecting to the auth server'
      )

      const response = await withTimeout(
        socket.emitWithAck(event, message),
        ACK_TIMEOUT_MS,
        'Timed out waiting for the auth server response'
      )

      return handleResponse<T>(response, message)
    } finally {
      // Always close the socket, including on connect/ack timeouts and errors.
      socket.close()
    }
  }

  const handleResponse = <T>(response: { error?: string } & T, message: { requestId: string }): T => {
    if (response.error?.includes('already been fulfilled')) {
      throw new RequestFulfilledError(message.requestId)
    } else if (response.error?.includes('not found')) {
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

  const recover = async (requestId: string, signerAddress: string): Promise<RecoverResponse> => {
    let response: RecoverResponse | undefined

    try {
      response = await request<RecoverResponse>('recover', { requestId })

      // NOTE: do NOT normalize `response.method` casing here. It is dispatched downstream on its
      // EIP-1193 canonical form (RequestPage switches on `case 'eth_sendTransaction'` and forwards
      // the method verbatim to the wallet), so lowercasing it would break the normal transaction
      // path. The allowlist guard and isSignatureMethod already compare case-insensitively, so a
      // non-canonical-cased method still fails safe (the wallet rejects an unknown-cased method)
      // without corrupting the canonical case.

      // If the sender defined in the request is different than the one that is connected, show an
      // error. Compare both sides case-insensitively — the server is not guaranteed to lowercase
      // `sender`, and a checksummed address must still match the connected (lowercased) account.
      if (response.sender && response.sender.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new DifferentSenderError(signerAddress, response.sender)
      }

      if (response.expiration && new Date(response.expiration) < new Date()) {
        throw new ExpiredRequestError(requestId, response.expiration)
      }

      // Reject methods the auth site does not support (e.g. the dangerous legacy `eth_sign`)
      // before anything is forwarded to the wallet.
      assertMethodIsAllowed(response.method)

      // Reject requests that ask the wallet to sign a Decentraland identity-authorization
      // payload, which would yield an auth chain that impersonates the user.
      assertRequestIsNotImpersonatingSignIn(response.method, response.params)

      trackEvent(TrackingEvents.REQUEST_INTERACTION, {
        type: RequestInteractionType.WALLET_INTERACTION,
        requestType: response.method
      })

      return response
    } catch (e) {
      // Don't report fulfilled requests to Sentry — they are an expected state after successful login
      if (!(e instanceof RequestFulfilledError)) {
        handleError(e, 'Error recovering request', {
          trackingData: {
            browserTime: Date.now(),
            requestType: response?.method ?? 'Unknown'
          },
          trackingEvent: TrackingEvents.REQUEST_LOADING_ERROR
        })
      }
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
