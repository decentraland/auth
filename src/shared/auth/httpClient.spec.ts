import { AuthIdentity } from '@dcl/crypto'
import signedFetchMock from 'decentraland-crypto-fetch'
import { getAnalytics } from '../../modules/analytics/segment'
import { TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import {
  DifferentSenderError,
  ExpiredRequestError,
  ImpersonatedSignInError,
  MalformedSignatureRequestError,
  RequestFulfilledError,
  RequestNotFoundError,
  SimulationUnavailableError
} from './errors'
import { createAuthServerHttpClient } from './httpClient'
import { RecoverResponse, SimulationRequestBody, SimulationResponseBody } from './types'
// Mock dependencies
jest.mock('@sentry/react')
jest.mock('../../modules/analytics/segment')
jest.mock('../../modules/config')
jest.mock('decentraland-crypto-fetch', () => jest.fn())

// Mock console.error to prevent errors from being logged
jest.spyOn(console, 'error').mockImplementation(() => undefined)

describe('createAuthServerClient', () => {
  // Common test variables
  const mockUrl = 'http://mock-auth-server.com'
  const mockRequestId = 'mock-request-id'
  const mockSender = '0xmocksender'
  const mockSignerAddress = '0xMockSignerAddress'
  const mockSignerAddressLower = '0xmocksigneraddress'

  // Mock fetch
  let mockFetch: jest.Mock
  // Mock analytics track (module-scoped so tests can assert the events sent)
  let mockTrack: jest.Mock

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock analytics
    mockTrack = jest.fn()
    mockFetch = jest.fn()
    const mockAnalytics = { track: mockTrack }

    // Setup fetch mock
    // Mock fetch implementation
    global.fetch = mockFetch

    // Setup config mock
    ;(config.get as jest.Mock).mockReturnValue(mockUrl)

    // Setup analytics mock
    ;(getAnalytics as jest.Mock).mockReturnValue(mockAnalytics)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when recovering a request', () => {
    let client: ReturnType<typeof createAuthServerHttpClient>
    let mockResponse: RecoverResponse

    beforeEach(() => {
      client = createAuthServerHttpClient()

      mockResponse = {
        sender: mockSignerAddressLower,
        expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour in the future
        method: 'personal_sign',
        params: ['hello', mockSignerAddressLower]
      }
    })

    describe('when the request is successful', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should recover the given request', async () => {
        await client.recover(mockRequestId, mockSignerAddress)

        expect(mockFetch).toHaveBeenCalledWith(mockUrl + '/v2/requests/' + mockRequestId, { method: 'GET' })
      })

      it('should return the response', async () => {
        const result = await client.recover(mockRequestId, mockSignerAddress)

        expect(result).toEqual(mockResponse)
      })
    })

    describe('and the method casing differs from the canonical EIP-1193 spelling', () => {
      beforeEach(() => {
        mockResponse.method = 'ETH_SENDTRANSACTION'
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should return the method pinned to its canonical spelling so the transaction path still matches', async () => {
        const result = await client.recover(mockRequestId, mockSignerAddress)

        expect(result.method).toBe('eth_sendTransaction')
      })
    })

    describe('when the response contains an error', () => {
      const errorMessage = 'Error recovering request'

      beforeEach(() => {
        mockResponse.error = errorMessage
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: errorMessage })
        })
      })

      it('should throw an error with the error message', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toThrow(errorMessage)
      })
    })

    describe('when the sender does not match', () => {
      beforeEach(() => {
        mockResponse.sender = 'different-sender'
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should throw a DifferentSenderError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(DifferentSenderError)
      })
    })

    describe('when the request is expired', () => {
      beforeEach(() => {
        mockResponse.expiration = new Date(Date.now() - 3600000).toISOString() // 1 hour in the past
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should throw an ExpiredRequestError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(ExpiredRequestError)
      })
    })

    describe('when the request fails due to network error', () => {
      beforeEach(() => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))
      })

      it('should throw the network error', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toThrow('Network error')
      })
    })

    describe('when a method carries a sign-in payload', () => {
      beforeEach(() => {
        mockResponse.method = 'personal_sign'
        mockResponse.params = [
          [
            'Decentraland Login',
            'Ephemeral address: 0x1234567890123456789012345678901234567890',
            'Expiration: 2100-01-01T00:00:00.000Z'
          ].join('\n')
        ]
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should throw an ImpersonatedSignInError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(ImpersonatedSignInError)
      })
    })

    describe('when a typed-data request has the canonical [signer, typed data] params', () => {
      beforeEach(() => {
        mockResponse.method = 'eth_signTypedData_v4'
        mockResponse.params = [mockSignerAddress, JSON.stringify({ primaryType: 'Statement', domain: {}, types: {}, message: {} })]
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should recover the request', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).resolves.toEqual(mockResponse)
      })
    })

    describe('when a personal_sign request arrives as [signer, message]', () => {
      beforeEach(() => {
        mockResponse.method = 'personal_sign'
        mockResponse.params = [mockSignerAddressLower, 'hello']
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should return the params reordered to [message, signer]', async () => {
        const result = await client.recover(mockRequestId, mockSignerAddress)

        expect(result.params).toEqual(['hello', mockSignerAddressLower])
      })
    })

    describe('when a typed-data request carries two payloads and no signer address', () => {
      beforeEach(() => {
        mockResponse.method = 'eth_signTypedData_v4'
        mockResponse.params = [
          JSON.stringify({ primaryType: 'Statement', domain: {}, types: {}, message: { text: 'harmless' } }),
          JSON.stringify({
            primaryType: 'Permit',
            domain: {},
            types: {},
            message: { spender: '0x000000000000000000000000000000000000dead' }
          })
        ]
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should throw a MalformedSignatureRequestError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(MalformedSignatureRequestError)
      })
    })
  })

  describe('when sending a successful outcome', () => {
    let client: ReturnType<typeof createAuthServerHttpClient>
    const mockResult = 'someResult'

    beforeEach(() => {
      client = createAuthServerHttpClient()
    })

    describe('when the request is successful', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })
      })

      it('should send the successful outcome and resolve', async () => {
        await client.sendSuccessfulOutcome(mockRequestId, mockSender, mockResult)

        expect(mockFetch).toHaveBeenCalledWith(mockUrl + '/v2/requests/' + mockRequestId + '/outcome', {
          method: 'POST',
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: mockSender,
            result: mockResult
          })
        })
      })
    })

    describe('when the response contains an error', () => {
      let message: { error: string }
      beforeEach(() => {
        message = { error: 'an error' }
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve(message)
        })
      })

      describe('when the error is an expiration error', () => {
        beforeEach(() => {
          message.error = 'Request has expired'
        })

        it('should propagate the expiration error', async () => {
          await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toBeInstanceOf(ExpiredRequestError)
        })
      })

      describe('when the error is a not found error', () => {
        beforeEach(() => {
          message.error = 'Request not found'
        })

        it('should propagate the not found error', async () => {
          await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toBeInstanceOf(RequestNotFoundError)
        })
      })

      describe('when the error is an already fulfilled error', () => {
        beforeEach(() => {
          message.error = 'Request with id "mock-request-id" has already been fulfilled'
        })

        it('should propagate a RequestFulfilledError', async () => {
          await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toBeInstanceOf(RequestFulfilledError)
        })
      })

      describe('when the error is an already has a response error', () => {
        beforeEach(() => {
          message.error = 'Request with id "mock-request-id" already has a response'
        })

        it('should propagate a RequestFulfilledError because the request was already answered', async () => {
          await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toBeInstanceOf(RequestFulfilledError)
        })
      })

      describe('when the error is a different error', () => {
        beforeEach(() => {
          message.error = 'Unknown error'
        })

        it('should propagate the error', async () => {
          await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toThrow(message.error)
        })
      })
    })

    describe('when the request fails due to network error', () => {
      const error = new Error('Network error')

      beforeEach(() => {
        mockFetch.mockRejectedValueOnce(error)
      })

      it('should handle and rethrow the error', async () => {
        await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toThrow('Network error')
      })
    })
  })

  describe('when sending a failed outcome', () => {
    let client: ReturnType<typeof createAuthServerHttpClient>
    let mockError: { code: number; message: string }

    beforeEach(() => {
      client = createAuthServerHttpClient()
      mockError = { code: 400, message: 'Bad request' }
    })

    describe('when the request is successful', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true
        })
      })

      it('should send the failed outcome and resolve', async () => {
        await client.sendFailedOutcome(mockRequestId, mockSender, mockError)

        expect(mockFetch).toHaveBeenCalledWith(mockUrl + '/v2/requests/' + mockRequestId + '/outcome', {
          method: 'POST',
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: mockSender,
            error: mockError
          })
        })
      })
    })

    describe('when the response contains an error', () => {
      let message: { error: string }

      beforeEach(() => {
        message = { error: 'an error' }
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve(message)
        })
      })

      describe('when the error is an expiration error', () => {
        beforeEach(() => {
          message.error = 'Request has expired'
        })

        it('should propagate the expiration error', async () => {
          await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toBeInstanceOf(ExpiredRequestError)
        })
      })

      describe('when the error is a not found error', () => {
        beforeEach(() => {
          message.error = 'Request not found'
        })

        it('should propagate the not found error', async () => {
          await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toBeInstanceOf(RequestNotFoundError)
        })
      })

      describe('when the error is an already has a response error', () => {
        beforeEach(() => {
          message.error = 'Request with id "mock-request-id" already has a response'
        })

        it('should propagate a RequestFulfilledError because the request was already answered', async () => {
          await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toBeInstanceOf(RequestFulfilledError)
        })
      })

      describe('when the error is a different error', () => {
        beforeEach(() => {
          message.error = 'Unknown error'
        })

        it('should propagate the error', async () => {
          await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toThrow(message.error)
        })
      })
    })

    describe('when the request fails due to network error', () => {
      const error = new Error('Network error')

      beforeEach(() => {
        mockFetch.mockRejectedValueOnce(error)
      })

      it('should handle and rethrow the error', async () => {
        await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toThrow('Network error')
      })
    })
  })

  describe('when posting an identity', () => {
    let client: ReturnType<typeof createAuthServerHttpClient>
    let mockIdentity: AuthIdentity

    const signedFetch = signedFetchMock as unknown as jest.Mock

    beforeEach(() => {
      client = createAuthServerHttpClient()
      mockIdentity = {
        ephemeralIdentity: {
          address: '0x123',
          publicKey: '0xpubkey',
          privateKey: '0xprivkey'
        },
        expiration: new Date(),
        authChain: []
      } as AuthIdentity
    })

    describe('when the request is successful', () => {
      const mockResponse = {
        identityId: 'mock-identity-id',
        expiration: new Date().toISOString()
      }

      beforeEach(() => {
        signedFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should post the identity and return the response', async () => {
        const result = await client.postIdentity(mockIdentity)

        expect(signedFetch).toHaveBeenCalledWith(mockUrl + '/identities', {
          method: 'POST',
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ identity: mockIdentity, isMobile: false }),
          identity: mockIdentity
        })
        expect(result).toEqual(mockResponse)
      })

      it('should track the success without an authRequestId when none is provided', async () => {
        await client.postIdentity(mockIdentity)

        expect(mockTrack).toHaveBeenCalledWith(TrackingEvents.DEEP_LINK_AUTH_SUCCESS, { type: 'success' })
      })

      it('should forward the authRequestId onto the success tracking event when provided', async () => {
        await client.postIdentity(mockIdentity, { authRequestId: 'a-request-uuid' })

        expect(mockTrack).toHaveBeenCalledWith(TrackingEvents.DEEP_LINK_AUTH_SUCCESS, {
          type: 'success',
          authRequestId: 'a-request-uuid'
        })
      })
    })

    describe('when the response is not ok', () => {
      beforeEach(() => {
        signedFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to create identity' })
        })
      })

      it('should throw an error with the error message', async () => {
        await expect(client.postIdentity(mockIdentity)).rejects.toThrow('Failed to create identity')
      })
    })

    describe('when the response is not ok and has no error message', () => {
      beforeEach(() => {
        signedFetch.mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({})
        })
      })

      it('should throw a default error message', async () => {
        await expect(client.postIdentity(mockIdentity)).rejects.toThrow('Failed to create identity')
      })
    })

    describe('when the request fails due to network error', () => {
      beforeEach(() => {
        signedFetch.mockRejectedValueOnce(new Error('Network error'))
      })

      it('should handle and rethrow the error', async () => {
        await expect(client.postIdentity(mockIdentity)).rejects.toThrow('Network error')
      })
    })
  })

  describe('when simulating a transaction', () => {
    let client: ReturnType<typeof createAuthServerHttpClient>
    let body: SimulationRequestBody

    beforeEach(() => {
      client = createAuthServerHttpClient()
      body = {
        chainId: 137,
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        data: '0x',
        value: '0'
      }
    })

    describe('and the server responds with a summary', () => {
      let response: SimulationResponseBody

      beforeEach(() => {
        response = { status: 'success', assetChanges: [], approvalChanges: [], balanceChanges: [], events: [] }
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(response)
        })
      })

      it('should POST the body to the /simulations endpoint', async () => {
        await client.simulateTransaction(body)
        expect(mockFetch).toHaveBeenCalledWith(
          mockUrl + '/simulations',
          expect.objectContaining({ method: 'POST', body: JSON.stringify(body) })
        )
      })

      it('should resolve with the normalized summary', async () => {
        await expect(client.simulateTransaction(body)).resolves.toEqual(response)
      })
    })

    describe('and the server responds with a non-200 status', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 502, body: undefined })
      })

      it('should throw a SimulationUnavailableError', async () => {
        await expect(client.simulateTransaction(body)).rejects.toBeInstanceOf(SimulationUnavailableError)
      })
    })

    describe('and the request fails or times out', () => {
      beforeEach(() => {
        mockFetch.mockRejectedValueOnce(new Error('The operation was aborted due to timeout'))
      })

      it('should throw a SimulationUnavailableError', async () => {
        await expect(client.simulateTransaction(body)).rejects.toBeInstanceOf(SimulationUnavailableError)
      })
    })
  })
})
