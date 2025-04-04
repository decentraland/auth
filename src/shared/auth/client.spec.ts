import { io } from 'socket.io-client'
import { getAnalytics } from '../../modules/analytics/segment'
import { config } from '../../modules/config'
import { createAuthServerClient, RecoverResponse } from './client'
import { DifferentSenderError, ExpiredRequestError, RequestNotFoundError } from './errors'

// Mock dependencies
jest.mock('socket.io-client')
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

  // Mock socket and its methods
  const mockEmitWithAck = jest.fn()
  const mockClose = jest.fn()
  const mockOn = jest.fn()
  const mockSocket = {
    on: mockOn,
    emitWithAck: mockEmitWithAck,
    close: mockClose
  }

  // Mock analytics
  const mockTrack = jest.fn()
  const mockAnalytics = { track: mockTrack }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup socket.io mock
    ;(io as jest.Mock).mockReturnValue(mockSocket)

    // Setup config mock
    ;(config.get as jest.Mock).mockReturnValue(mockUrl)

    // Setup analytics mock
    ;(getAnalytics as jest.Mock).mockReturnValue(mockAnalytics)

    // Setup socket connect event handler
    mockOn.mockImplementation((event, callback) => {
      if (event === 'connect') {
        callback()
      }
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when recovering a request', () => {
    let client: ReturnType<typeof createAuthServerClient>
    let mockResponse: RecoverResponse

    beforeEach(() => {
      client = createAuthServerClient()

      mockResponse = {
        sender: mockSignerAddressLower,
        expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour in the future
        method: 'dcl_personal_sign'
      }

      mockEmitWithAck.mockResolvedValueOnce(mockResponse)
    })

    describe('when the request is successful', () => {
      beforeEach(() => {
        // No additional setup needed
      })

      it('should connect to the server and emit the recover event', async () => {
        await client.recover(mockRequestId, mockSignerAddress)

        expect(io).toHaveBeenCalledWith(mockUrl)
        expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function))
        expect(mockEmitWithAck).toHaveBeenCalledWith('recover', { requestId: mockRequestId })
        expect(mockClose).toHaveBeenCalled()
      })

      it('should return the response if everything is valid', async () => {
        const result = await client.recover(mockRequestId, mockSignerAddress)

        expect(result).toEqual(mockResponse)
      })
    })

    describe('when the response contains an error', () => {
      const errorMessage = 'Error recovering request'

      beforeEach(() => {
        mockResponse.error = errorMessage
      })

      it('should throw an error with the error message', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toThrow(errorMessage)
      })
    })

    describe('when the sender does not match', () => {
      beforeEach(() => {
        mockResponse.sender = 'different-sender'
      })

      it('should throw a DifferentSenderError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(DifferentSenderError)
      })
    })

    describe('when the request is expired', () => {
      beforeEach(() => {
        mockResponse.expiration = new Date(Date.now() - 3600000).toISOString() // 1 hour in the past
      })

      it('should throw an ExpiredRequestError', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toBeInstanceOf(ExpiredRequestError)
      })
    })

    describe('when the request fails due to network error', () => {
      beforeEach(() => {
        mockEmitWithAck.mockReset()
        mockEmitWithAck.mockRejectedValueOnce(new Error('Network error'))
      })

      it('should throw the network error', async () => {
        await expect(client.recover(mockRequestId, mockSignerAddress)).rejects.toThrow('Network error')
      })
    })
  })

  describe('when sending a successful outcome', () => {
    let client: ReturnType<typeof createAuthServerClient>
    const mockResult = { success: true }

    beforeEach(() => {
      client = createAuthServerClient()
    })

    describe('when the request is successful', () => {
      beforeEach(() => {
        mockEmitWithAck.mockResolvedValueOnce({})
      })

      it('should emit the outcome event with success result', async () => {
        await client.sendSuccessfulOutcome(mockRequestId, mockSender, mockResult)

        expect(mockEmitWithAck).toHaveBeenCalledWith('outcome', {
          requestId: mockRequestId,
          sender: mockSender,
          result: mockResult
        })
        expect(mockClose).toHaveBeenCalled()
      })
    })

    describe('when the response contains an error', () => {
      let message: { error: string }
      beforeEach(() => {
        message = { error: 'an error' }
        mockEmitWithAck.mockResolvedValueOnce(message)
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
        mockEmitWithAck.mockRejectedValueOnce(error)
      })

      it('should handle and rethrow the error', async () => {
        await expect(client.sendSuccessfulOutcome(mockRequestId, mockSender, {})).rejects.toThrow('Network error')
      })
    })
  })

  describe('when sending a failed outcome', () => {
    let client: ReturnType<typeof createAuthServerClient>
    const mockError = { code: 400, message: 'Bad request' }

    beforeEach(() => {
      client = createAuthServerClient()
    })

    describe('when the request is successful', () => {
      beforeEach(() => {
        mockEmitWithAck.mockResolvedValueOnce({})
      })

      it('should emit the outcome event with error details', async () => {
        await client.sendFailedOutcome(mockRequestId, mockSender, mockError)

        expect(mockEmitWithAck).toHaveBeenCalledWith('outcome', {
          requestId: mockRequestId,
          sender: mockSender,
          error: mockError
        })
        expect(mockClose).toHaveBeenCalled()
      })
    })

    describe('when the response contains an error', () => {
      let message: { error: string }
      beforeEach(() => {
        message = { error: 'an error' }
        mockEmitWithAck.mockResolvedValueOnce(message)
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
        mockEmitWithAck.mockRejectedValueOnce(error)
      })

      it('should handle and rethrow the error', async () => {
        await expect(client.sendFailedOutcome(mockRequestId, mockSender, mockError)).rejects.toThrow('Network error')
      })
    })
  })
})
