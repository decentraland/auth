import { createContentClient } from 'dcl-catalyst-client'
import { deployWithCatalystRotation, isRetryableError } from './deploy'
import { DeploymentError } from './errors'
import { getCatalystUrlsForRotation } from './utils'

jest.mock('dcl-catalyst-client', () => ({
  createContentClient: jest.fn()
}))

jest.mock('../../shared/fetcher', () => ({
  createFetcher: jest.fn().mockReturnValue({ fetch: jest.fn() })
}))

jest.mock('./utils')

jest.spyOn(console, 'warn').mockImplementation(() => undefined)
jest.spyOn(console, 'error').mockImplementation(() => undefined)

const mockCreateContentClient = createContentClient as jest.MockedFunction<typeof createContentClient>
const mockGetCatalystUrlsForRotation = getCatalystUrlsForRotation as jest.MockedFunction<typeof getCatalystUrlsForRotation>

const catalystUrls = ['https://catalyst1.zone/content', 'https://catalyst2.zone/content', 'https://catalyst3.zone/content']

const createMockEntity = () => ({
  entityId: 'mock-entity-id',
  files: new Map<string, Uint8Array>(),
  authChain: []
})

const createMockResponse = (ok: boolean, status: number, body: string = '') =>
  ({
    ok,
    status,
    text: jest.fn().mockResolvedValue(body)
  }) as unknown as Response

describe('deployWithCatalystRotation', () => {
  beforeEach(() => {
    mockGetCatalystUrlsForRotation.mockReturnValue(catalystUrls)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when the deployment succeeds on the first catalyst', () => {
    it('should resolve without trying other catalysts', async () => {
      const mockClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
      mockCreateContentClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createContentClient>)

      await expect(
        deployWithCatalystRotation({
          entity: createMockEntity()
        })
      ).resolves.not.toThrow()

      expect(mockCreateContentClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the first catalyst returns a 5xx error', () => {
    let mockClient1: { deploy: jest.Mock }
    let mockClient2: { deploy: jest.Mock }

    beforeEach(() => {
      mockClient1 = { deploy: jest.fn().mockResolvedValue(createMockResponse(false, 500, 'Internal Server Error')) }
      mockClient2 = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
      mockCreateContentClient
        .mockReturnValueOnce(mockClient1 as unknown as ReturnType<typeof createContentClient>)
        .mockReturnValueOnce(mockClient2 as unknown as ReturnType<typeof createContentClient>)
    })

    it('should retry with the next catalyst', async () => {
      await deployWithCatalystRotation({
        entity: createMockEntity()
      })

      expect(mockCreateContentClient).toHaveBeenCalledTimes(2)
      expect(mockClient2.deploy).toHaveBeenCalled()
    })
  })

  describe('when a catalyst returns a 4xx error', () => {
    beforeEach(() => {
      const mockClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(false, 400, 'Bad Request')) }
      mockCreateContentClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createContentClient>)
    })

    it('should not retry and throw immediately with a DeploymentError', async () => {
      await expect(
        deployWithCatalystRotation({
          entity: createMockEntity()
        })
      ).rejects.toThrow(DeploymentError)

      expect(mockCreateContentClient).toHaveBeenCalledTimes(1)
    })

    it('should include the status code and response body in the error', async () => {
      try {
        await deployWithCatalystRotation({
          entity: createMockEntity()
        })
        fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DeploymentError)
        const deploymentError = error as DeploymentError
        expect(deploymentError.statusCode).toBe(400)
        expect(deploymentError.responseBody).toBe('Bad Request')
        expect(deploymentError.catalystUrl).toBe(catalystUrls[0])
      }
    })
  })

  describe('when a network error occurs', () => {
    let mockClient1: { deploy: jest.Mock }
    let mockClient2: { deploy: jest.Mock }

    beforeEach(() => {
      mockClient1 = { deploy: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) }
      mockClient2 = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
      mockCreateContentClient
        .mockReturnValueOnce(mockClient1 as unknown as ReturnType<typeof createContentClient>)
        .mockReturnValueOnce(mockClient2 as unknown as ReturnType<typeof createContentClient>)
    })

    it('should retry with the next catalyst', async () => {
      await deployWithCatalystRotation({
        entity: createMockEntity()
      })

      expect(mockCreateContentClient).toHaveBeenCalledTimes(2)
    })
  })

  describe('when all catalysts fail with 5xx errors', () => {
    beforeEach(() => {
      mockCreateContentClient.mockImplementation(
        () =>
          ({
            deploy: jest.fn().mockResolvedValue(createMockResponse(false, 502, 'Bad Gateway'))
          }) as unknown as ReturnType<typeof createContentClient>
      )
    })

    it('should throw after exhausting all catalysts', async () => {
      await expect(
        deployWithCatalystRotation({
          entity: createMockEntity()
        })
      ).rejects.toThrow(DeploymentError)

      expect(mockCreateContentClient).toHaveBeenCalledTimes(catalystUrls.length)
    })

    it('should throw with the last catalyst URL in the error', async () => {
      try {
        await deployWithCatalystRotation({
          entity: createMockEntity()
        })
        fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DeploymentError)
        const deploymentError = error as DeploymentError
        expect(deploymentError.catalystUrl).toBe(catalystUrls[catalystUrls.length - 1])
        expect(deploymentError.statusCode).toBe(502)
        expect(deploymentError.responseBody).toBe('Bad Gateway')
      }
    })
  })

  describe('when all catalysts fail with network errors', () => {
    beforeEach(() => {
      mockCreateContentClient.mockImplementation(
        () =>
          ({
            deploy: jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
          }) as unknown as ReturnType<typeof createContentClient>
      )
    })

    it('should throw a DeploymentError after exhausting all catalysts', async () => {
      await expect(
        deployWithCatalystRotation({
          entity: createMockEntity()
        })
      ).rejects.toThrow(DeploymentError)

      expect(mockCreateContentClient).toHaveBeenCalledTimes(catalystUrls.length)
    })

    it('should include the catalyst URL and original message but no status code', async () => {
      try {
        await deployWithCatalystRotation({
          entity: createMockEntity()
        })
        fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DeploymentError)
        const deploymentError = error as DeploymentError
        expect(deploymentError.message).toBe('Failed to fetch')
        expect(deploymentError.statusCode).toBeUndefined()
        expect(deploymentError.responseBody).toBeUndefined()
        expect(deploymentError.catalystUrl).toBe(catalystUrls[catalystUrls.length - 1])
      }
    })
  })

  describe('when disabledCatalysts is provided', () => {
    it('should pass disabledCatalysts to getCatalystUrlsForRotation', async () => {
      const mockClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
      mockCreateContentClient.mockReturnValue(mockClient as unknown as ReturnType<typeof createContentClient>)

      const disabledCatalysts = ['https://disabled.zone']
      await deployWithCatalystRotation({
        entity: createMockEntity(),
        disabledCatalysts
      })

      expect(mockGetCatalystUrlsForRotation).toHaveBeenCalledWith(disabledCatalysts)
    })
  })
})

describe('isRetryableError', () => {
  describe('when the error is a DeploymentError with a 4xx status code', () => {
    it('should return false', () => {
      expect(isRetryableError(new DeploymentError('Bad Request', 400, 'Bad Request', 'https://catalyst.zone'))).toBe(false)
    })
  })

  describe('when the error is a DeploymentError with a 5xx status code', () => {
    it('should return true', () => {
      expect(isRetryableError(new DeploymentError('Server Error', 500, 'Server Error', 'https://catalyst.zone'))).toBe(true)
    })
  })

  describe('when the error is a network error', () => {
    it('should return true', () => {
      expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true)
    })
  })

  describe('when the error is a DeploymentError with no status code', () => {
    it('should return true', () => {
      expect(isRetryableError(new DeploymentError('Unknown', undefined, undefined, 'https://catalyst.zone'))).toBe(true)
    })
  })
})
