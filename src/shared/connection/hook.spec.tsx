import { PropsWithChildren } from 'react'
import { EventEmitter } from 'events'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ProviderType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'
import { ConnectionData, getCurrentConnectionData } from './connection'
import { ConnectionProvider, useCurrentConnectionData } from './ConnectionProvider'
import { getIdentitySignature as getIdentitySignatureUtil } from './identity'

jest.mock('@dcl/single-sign-on-client')
jest.mock('./connection')
jest.mock('./identity')
jest.mock('decentraland-connect', () => ({
  connection: {
    tryPreviousConnection: jest.fn()
  }
}))

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

  describe('when the connection data is available but identity is undefined', () => {
    let mockConnectionData: ConnectionData

    beforeEach(() => {
      mockConnectionData = createMockConnectionData({ identity: undefined })
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should return the account even without an identity', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.account).toBe('0x123')
        expect(result.current.identity).toBeUndefined()
        expect(result.current.provider).toBe(mockConnectionData.provider)
        expect(result.current.providerType).toBe(ProviderType.MAGIC)
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

  describe('when getIdentitySignature is called', () => {
    let mockProvider: ConnectionData['provider']
    let mockIdentity: ConnectionData['identity']

    beforeEach(() => {
      mockProvider = createMockProvider()
      mockIdentity = { ephemeralIdentity: {}, expiration: new Date(), authChain: {} } as ConnectionData['identity']
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(null)
      ;(getIdentitySignatureUtil as jest.Mock).mockResolvedValue(mockIdentity)
    })

    describe('and no existing connection is provided', () => {
      beforeEach(() => {
        ;(connection.tryPreviousConnection as jest.Mock).mockResolvedValue({
          account: '0xabc',
          provider: mockProvider,
          providerType: ProviderType.MAGIC,
          chainId: 1
        })
      })

      it('should call tryPreviousConnection to obtain the connection', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
          await result.current.getIdentitySignature()
        })

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(connection.tryPreviousConnection).toHaveBeenCalled()
      })

      it('should update the context with the connection data', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.account).toBeUndefined()

        await act(async () => {
          await result.current.getIdentitySignature()
        })

        expect(result.current.account).toBe('0xabc')
        expect(result.current.identity).toBe(mockIdentity)
        expect(result.current.provider).toBe(mockProvider)
        expect(result.current.providerType).toBe(ProviderType.MAGIC)
        expect(result.current.chainId).toBe(1)
      })

      it('should call the identity signature utility with the account and provider', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
          await result.current.getIdentitySignature()
        })

        expect(getIdentitySignatureUtil).toHaveBeenCalledWith('0xabc', mockProvider)
      })

      it('should not call getCurrentConnectionData again after generating the identity', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })
        ;(getCurrentConnectionData as jest.Mock).mockClear()

        await act(async () => {
          await result.current.getIdentitySignature()
        })

        expect(getCurrentConnectionData).not.toHaveBeenCalled()
      })
    })

    describe('and an existing connection is provided', () => {
      let existingConnection: ConnectionResponse

      beforeEach(() => {
        existingConnection = {
          account: '0xdef',
          provider: mockProvider as unknown as ConnectionResponse['provider'],
          providerType: ProviderType.INJECTED,
          chainId: 137
        }
      })

      it('should not call tryPreviousConnection', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
          await result.current.getIdentitySignature(existingConnection)
        })

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(connection.tryPreviousConnection).not.toHaveBeenCalled()
      })

      it('should update the context with the provided connection data', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
          await result.current.getIdentitySignature(existingConnection)
        })

        expect(result.current.account).toBe('0xdef')
        expect(result.current.identity).toBe(mockIdentity)
        expect(result.current.provider).toBe(mockProvider)
        expect(result.current.providerType).toBe(ProviderType.INJECTED)
        expect(result.current.chainId).toBe(137)
      })

      it('should call the identity signature utility with the provided account and provider', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
          await result.current.getIdentitySignature(existingConnection)
        })

        expect(getIdentitySignatureUtil).toHaveBeenCalledWith('0xdef', mockProvider)
      })
    })

    describe('and the connection response is missing providerType', () => {
      it('should throw an error', async () => {
        ;(connection.tryPreviousConnection as jest.Mock).mockResolvedValue({
          account: '0xabc',
          provider: mockProvider,
          providerType: undefined,
          chainId: 1
        })

        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await expect(
          act(async () => {
            await result.current.getIdentitySignature()
          })
        ).rejects.toThrow('No active connection found')
      })
    })

    describe('and multiple callers invoke getIdentitySignature concurrently', () => {
      beforeEach(() => {
        ;(connection.tryPreviousConnection as jest.Mock).mockResolvedValue({
          account: '0xabc',
          provider: mockProvider,
          providerType: ProviderType.MAGIC,
          chainId: 1
        })
      })

      it('should only call the identity signature utility once', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        await act(async () => {
          await Promise.all([result.current.getIdentitySignature(), result.current.getIdentitySignature()])
        })

        expect(getIdentitySignatureUtil).toHaveBeenCalledTimes(1)
      })

      it('should return the same identity to both callers', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        let identity1: ConnectionData['identity']
        let identity2: ConnectionData['identity']

        await act(async () => {
          ;[identity1, identity2] = await Promise.all([result.current.getIdentitySignature(), result.current.getIdentitySignature()])
        })

        expect(identity1).toBe(mockIdentity)
        expect(identity2).toBe(mockIdentity)
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
      let newIdentity: ConnectionData['identity']

      beforeEach(() => {
        newIdentity = { ephemeralIdentity: {}, expiration: new Date(), authChain: {} } as ConnectionData['identity']
        ;(localStorageGetIdentity as jest.Mock).mockReturnValue(newIdentity)
      })

      it('should update the account to the new wallet', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.account).toBe('0x123')
        })

        await act(async () => {
          ;(mockProvider as unknown as EventEmitter).emit('accountsChanged', ['0x456'])
        })

        await waitFor(() => {
          expect(result.current.account).toBe('0x456')
          expect(result.current.identity).toBe(newIdentity)
        })
      })

      it('should look up the identity from localStorage without reconnecting', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.account).toBe('0x123')
        })
        ;(getCurrentConnectionData as jest.Mock).mockClear()

        await act(async () => {
          ;(mockProvider as unknown as EventEmitter).emit('accountsChanged', ['0x456'])
        })

        expect(localStorageGetIdentity).toHaveBeenCalledWith('0x456')
        expect(getCurrentConnectionData).not.toHaveBeenCalled()
      })
    })

    describe('and the new wallet has no stored identity', () => {
      beforeEach(() => {
        ;(localStorageGetIdentity as jest.Mock).mockReturnValue(null)
      })

      it('should update the account with undefined identity', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.account).toBe('0x123')
        })

        await act(async () => {
          ;(mockProvider as unknown as EventEmitter).emit('accountsChanged', ['0x789'])
        })

        await waitFor(() => {
          expect(result.current.account).toBe('0x789')
          expect(result.current.identity).toBeUndefined()
        })
      })
    })

    describe('and the accounts array is empty', () => {
      it('should clear the account and identity', async () => {
        const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

        await waitFor(() => {
          expect(result.current.account).toBe('0x123')
        })

        await act(async () => {
          ;(mockProvider as unknown as EventEmitter).emit('accountsChanged', [])
        })

        await waitFor(() => {
          expect(result.current.account).toBeUndefined()
          expect(result.current.identity).toBeUndefined()
        })
      })
    })
  })

  describe('when the provider emits chainChanged', () => {
    let mockProvider: ConnectionData['provider']
    let mockConnectionData: ConnectionData

    beforeEach(() => {
      mockProvider = createMockProvider()
      mockConnectionData = createMockConnectionData({ provider: mockProvider })
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should update the chainId from the hex value', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.chainId).toBe(1)
      })

      await act(async () => {
        ;(mockProvider as unknown as EventEmitter).emit('chainChanged', '0x89')
      })

      await waitFor(() => {
        expect(result.current.chainId).toBe(137)
      })
    })

    it('should not call getCurrentConnectionData again', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current.chainId).toBe(1)
      })
      ;(getCurrentConnectionData as jest.Mock).mockClear()

      await act(async () => {
        ;(mockProvider as unknown as EventEmitter).emit('chainChanged', '0x89')
      })

      expect(getCurrentConnectionData).not.toHaveBeenCalled()
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
