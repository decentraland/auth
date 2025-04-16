import { getAnalytics } from '../../modules/analytics/segment'
import { config } from '../../modules/config'
import { DifferentSenderError, ExpiredRequestError, RequestNotFoundError } from './errors'
import { createAuthServerHttpClient } from './httpClient'
import { RecoverResponse } from './types'
// Mock dependencies
jest.mock('@sentry/react')
jest.mock('../../modules/analytics/segment')
jest.mock('../../modules/config')

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

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock analytics
    const mockTrack = jest.fn()
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
        method: 'dcl_personal_sign'
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
          ok: true
        })
      })

      it('should send the successful outcome and resolve', async () => {
        await client.sendSuccessfulOutcome(mockRequestId, mockSender, mockResult)

        expect(mockFetch).toHaveBeenCalledWith(mockUrl + '/v2/outcomes/' + mockRequestId, {
          method: 'POST',
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

        expect(mockFetch).toHaveBeenCalledWith(mockUrl + '/v2/outcomes/' + mockRequestId, {
          method: 'POST',
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
        await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toThrow('Network error')
      })
    })
  })
})
