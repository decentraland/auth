import { EventEmitter } from 'events'
import { PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ProviderType } from '@dcl/schemas'
import { ConnectionData, getCurrentConnectionData } from './connection'
import { ConnectionProvider, useCurrentConnectionData } from './ConnectionProvider'

jest.mock('./connection')

const wrapper = ({ children }: PropsWithChildren) => <ConnectionProvider>{children}</ConnectionProvider>

const createMockProvider = () => {
  return new EventEmitter() as unknown as ConnectionData['provider']
}

const createMockConnectionData = (overrides?: Partial<ConnectionData>): ConnectionData => ({
  account: '0x123',
  identity: { ephemeralIdentity: {}, expiration: new Date(), authChain: {} } as ConnectionData['identity'],
  provider: createMockProvider(),
  chainId: 1,
  providerType: ProviderType.MAGIC,
  ...overrides
})

describe('useCurrentConnectionData', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when initializing', () => {
    let resolvePromise: (value: null) => void

    beforeEach(() => {
      const controlledPromise = new Promise<null>(resolve => {
        resolvePromise = resolve
      })
      ;(getCurrentConnectionData as jest.Mock).mockImplementation(() => controlledPromise)
    })

    it('should set isLoading to true', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      const current = result.current

      await act(async () => {
        resolvePromise(null)
        await Promise.resolve()
      })

      expect(current.isLoading).toBe(true)
    })

    it('should have all connection fields as undefined', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      const current = result.current

      await act(async () => {
        resolvePromise(null)
        await Promise.resolve()
      })

      expect(current.account).toBeUndefined()
      expect(current.identity).toBeUndefined()
      expect(current.provider).toBeUndefined()
      expect(current.providerType).toBeUndefined()
      expect(current.chainId).toBeUndefined()
    })

    it('should call getCurrentConnectionData once', async () => {
      renderHook(() => useCurrentConnectionData(), { wrapper })

      await act(async () => {
        resolvePromise(null)
        await Promise.resolve()
      })

      expect(getCurrentConnectionData).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the connection data is available', () => {
    let mockConnectionData: ConnectionData

    beforeEach(() => {
      mockConnectionData = createMockConnectionData()
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should set isLoading to false', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should return the connection data', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.account).toBe(mockConnectionData.account)
        expect(result.current.identity).toBe(mockConnectionData.identity)
        expect(result.current.provider).toBe(mockConnectionData.provider)
        expect(result.current.providerType).toBe(mockConnectionData.providerType)
        expect(result.current.chainId).toBe(mockConnectionData.chainId)
      })
    })
  })

  describe('when the connection data is null', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(null)
    })

    it('should set isLoading to false', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should have all connection fields as undefined', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.account).toBeUndefined()
        expect(result.current.identity).toBeUndefined()
        expect(result.current.provider).toBeUndefined()
        expect(result.current.providerType).toBeUndefined()
        expect(result.current.chainId).toBeUndefined()
      })
    })
  })

  describe('when multiple hooks consume the same provider', () => {
    let mockConnectionData: ConnectionData

    beforeEach(() => {
      mockConnectionData = createMockConnectionData()
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should share the same account across hooks', async () => {
      const { result: result1 } = renderHook(() => useCurrentConnectionData(), { wrapper })
      const { result: result2 } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result1.current.account).toBe('0x123')
        expect(result2.current.account).toBe('0x123')
      })
    })
  })

  describe('when the provider emits accountsChanged', () => {
    let mockProvider: ConnectionData['provider']
    let mockConnectionData: ConnectionData

    beforeEach(() => {
      mockProvider = createMockProvider()
      mockConnectionData = createMockConnectionData({ provider: mockProvider })
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    describe('and the new wallet has a stored identity', () => {
      let updatedConnectionData: ConnectionData

      beforeEach(() => {
        updatedConnectionData = createMockConnectionData({
          account: '0x456',
          provider: mockProvider
        })
      })

      it('should update the account to the new wallet', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.account).toBe('0x123')
        })

        ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(updatedConnectionData)

        await act(async () => {
          ;(mockProvider as unknown as EventEmitter).emit('accountsChanged', ['0x456'])
        })

        await waitFor(() => {
          expect(result.current.account).toBe('0x456')
        })
      })
    })

    describe('and the new wallet has no stored identity', () => {
      it('should clear the account', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.account).toBe('0x123')
        })

        ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(null)

        await act(async () => {
          ;(mockProvider as unknown as EventEmitter).emit('accountsChanged', ['0x789'])
        })

        await waitFor(() => {
          expect(result.current.account).toBeUndefined()
        })
      })
    })
  })

  describe('when the provider emits chainChanged', () => {
    let mockProvider: ConnectionData['provider']
    let mockConnectionData: ConnectionData
    let updatedConnectionData: ConnectionData

    beforeEach(() => {
      mockProvider = createMockProvider()
      mockConnectionData = createMockConnectionData({ provider: mockProvider })
      updatedConnectionData = createMockConnectionData({
        provider: mockProvider,
        chainId: 137
      })
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should update the chainId', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.chainId).toBe(1)
      })

      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(updatedConnectionData)

      await act(async () => {
        ;(mockProvider as unknown as EventEmitter).emit('chainChanged', '0x89')
      })

      await waitFor(() => {
        expect(result.current.chainId).toBe(137)
      })
    })
  })

  describe('when the component unmounts', () => {
    let mockProvider: ConnectionData['provider']
    let mockConnectionData: ConnectionData

    beforeEach(() => {
      mockProvider = createMockProvider()
      mockConnectionData = createMockConnectionData({ provider: mockProvider })
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should remove the accountsChanged listener', async () => {
      const { unmount } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect((mockProvider as unknown as EventEmitter).listenerCount('accountsChanged')).toBe(1)
      })

      unmount()

      expect((mockProvider as unknown as EventEmitter).listenerCount('accountsChanged')).toBe(0)
    })

    it('should remove the chainChanged listener', async () => {
      const { unmount } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect((mockProvider as unknown as EventEmitter).listenerCount('chainChanged')).toBe(1)
      })

      unmount()

      expect((mockProvider as unknown as EventEmitter).listenerCount('chainChanged')).toBe(0)
    })
  })
})
