import { AuthIdentity } from '@dcl/crypto'
import signedFetchMock from 'decentraland-crypto-fetch'
import { getAnalytics } from '../../modules/analytics/segment'
import { TrackingEvents } from '../../modules/analytics/types'
import { config } from '../../modules/config'
import {
  DifferentSenderError,
  ExpiredRequestError,
  ImpersonatedSignInError,
  MalformedRequestError,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
  RequestFulfilledError,
  RequestNotFoundError
} from './errors'
import { createAuthServerHttpClient } from './httpClient'
import { RecoverResponse } from './types'
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
  // Real 20-byte addresses: recover requires the request to name the account it is for in the only form
  // the comparison can be made against (see assertRecoverResponseIsCanonical).
  const mockSender = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const mockSignerAddress = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa'
  const mockSignerAddressLower = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

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
        mockResponse.params = [{ to: '0xfef5c99885c3036e591b6e6db52482891834a5f4', data: '0x', value: '0x0' }]
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
        mockResponse.sender = mockSender
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should throw a DifferentSenderError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(DifferentSenderError)
      })
    })

    // `sender` and `expiration` are not description but authorization: one binds the request to the account
    // about to answer it, the other stops it being answerable forever. Both checks used to run only when
    // the field was there, so a response without one carried no restriction at all.
    describe('when the request names no account it is for', () => {
      describe.each([
        ['the field is missing', undefined],
        ['it is empty', ''],
        ['it is not an address', 'different-sender'],
        ['it is too short to be one', '0xabc'],
        ['it is not hexadecimal', '0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz']
      ])('and %s', (_case, sender) => {
        it('should refuse the request rather than answer one bound to nobody', async () => {
          mockResponse.sender = sender as string
          mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponse) })

          await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(MalformedRequestError)
        })
      })
    })

    describe('when the request carries no readable expiration', () => {
      describe.each([
        ['the field is missing', undefined],
        ['it is empty', ''],
        ['it is not a date', 'whenever'],
        ['it is a number rather than a timestamp', 1234567890]
      ])('and %s', (_case, expiration) => {
        it('should refuse the request rather than treat it as never expiring', async () => {
          mockResponse.expiration = expiration as string
          mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponse) })

          await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(MalformedRequestError)
        })
      })
    })

    describe('when the response is not the shape the review is made of', () => {
      describe.each([
        ['it is not an object', 'not a request'],
        ['it names no method', { sender: mockSignerAddressLower, expiration: new Date(Date.now() + 3600000).toISOString() }],
        [
          'its parameters are not a list',
          {
            sender: mockSignerAddressLower,
            expiration: new Date(Date.now() + 3600000).toISOString(),
            method: 'personal_sign',
            params: 'hello'
          }
        ]
      ])('and %s', (_case, body) => {
        it('should refuse it rather than read fields off it', async () => {
          mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) })

          await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(MalformedRequestError)
        })
      })
    })

    describe('when the request expires exactly now', () => {
      it('should treat it as expired rather than as still answerable', async () => {
        const now = new Date('2026-01-01T00:00:00.000Z')
        jest.useFakeTimers().setSystemTime(now)
        mockResponse.expiration = now.toISOString()
        mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockResponse) })

        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(ExpiredRequestError)

        jest.useRealTimers()
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
        mockResponse.params = [
          mockSignerAddress,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          JSON.stringify({ primaryType: 'Statement', domain: {}, types: { Statement: [] }, message: {} })
        ]
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should recover the request', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).resolves.toEqual(mockResponse)
      })
    })

    describe('when a typed-data request is a MetaTransaction carrying an undeclared second call (no longer rejected at recover)', () => {
      beforeEach(() => {
        mockResponse.method = 'eth_signTypedData_v4'
        mockResponse.params = [
          mockSignerAddress,
          JSON.stringify({
            types: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              MetaTransaction: [
                { name: 'nonce', type: 'uint256' },
                { name: 'from', type: 'address' },
                { name: 'functionData', type: 'bytes' }
              ]
            },
            domain: {
              name: 'DecentralandMarketplacePolygon',
              version: '1.0.0',
              verifyingContract: '0xa40b1d129b8906888720686f3a01921ddf37716f',
              salt: '0x0000000000000000000000000000000000000000000000000000000000000089'
            },
            primaryType: 'MetaTransaction',
            message: {
              nonce: 0,
              from: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd',
              functionData: `0xdeadbeef${'00'.repeat(64)}`,
              functionSignature: `0x2d0335ab${'00'.repeat(32)}`
            }
          })
        ]
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should recover the request, leaving the classifier to show the malformed MetaTransaction as unverified', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).resolves.toEqual(mockResponse)
      })
    })

    describe('when a transaction request carries calldata outside the data field', () => {
      beforeEach(() => {
        mockResponse.method = 'eth_sendTransaction'
        mockResponse.params = [{ to: '0xfef5c99885c3036e591b6e6db52482891834a5f4', data: '0x', extraCallData: '0xa9059cbb' }]
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })
      })

      it('should throw a MalformedTransactionRequestError at recover instead of at approve', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(MalformedTransactionRequestError)
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

      it('should throw a MalformedSignatureRequestError because wallets sign the first param', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(MalformedSignatureRequestError)
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

      it('should track the success without an authRequestId if the call gave none', async () => {
        await client.postIdentity(mockIdentity)

        expect(mockTrack).toHaveBeenCalledWith(TrackingEvents.DEEP_LINK_AUTH_SUCCESS, { type: 'success' })
      })

      it('should forward a given authRequestId onto the success tracking event', async () => {
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
})
