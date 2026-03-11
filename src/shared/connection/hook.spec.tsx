import { PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ProviderType } from '@dcl/schemas'
import { ConnectionData, getCurrentConnectionData } from './connection'
import { ConnectionProvider, useCurrentConnectionData } from './ConnectionProvider'

// Mock the connection module
jest.mock('./connection')

const wrapper = ({ children }: PropsWithChildren) => <ConnectionProvider>{children}</ConnectionProvider>

describe('useCurrentConnectionData', () => {
  let mockConnectionData: ConnectionData

  beforeEach(() => {
    mockConnectionData = {
      account: '0x123',
      identity: { ephemeralIdentity: {}, expiration: new Date(), authChain: {} } as ConnectionData['identity'],
      provider: {} as ConnectionData['provider'],
      chainId: 1,
      providerType: ProviderType.MAGIC
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when initializing', () => {
    let resolvePromise: (value: null) => void
    let controlledPromise: Promise<null>

    beforeEach(() => {
      controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      ;(getCurrentConnectionData as jest.Mock).mockImplementation(() => controlledPromise)
    })

    it('should return the initial state where isLoading is true and the other fields are undefined', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      const current = result.current

      // Now resolve the promise
      await act(async () => {
        resolvePromise(null)
        // Wait for any state updates to complete
        await Promise.resolve()
      })

      expect(current).toEqual({
        isLoading: true,
        account: undefined,
        identity: undefined,
        provider: undefined,
        providerType: undefined,
        chainId: undefined
      })

      expect(getCurrentConnectionData).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the connection data is available', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should return the connection data and set isLoading to false', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current).toEqual({
          isLoading: false,
          ...mockConnectionData
        })
      })
    })
  })

  describe('when the connection data is null', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(null)
    })

    it('should return the initial state where isLoading is false and the other fields are undefined', async () => {
      const { result } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result.current).toEqual({
          isLoading: false,
          account: undefined,
          identity: undefined,
          provider: undefined,
          providerType: undefined,
          chainId: undefined
        })
      })
    })
  })

  describe('when multiple hooks consume the same provider', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(mockConnectionData)
    })

    it('should share the same connection data across hooks', async () => {
      const { result: result1 } = renderHook(() => useCurrentConnectionData(), { wrapper })
      const { result: result2 } = renderHook(() => useCurrentConnectionData(), { wrapper })

      await waitFor(() => {
        expect(result1.current.account).toBe('0x123')
        expect(result2.current.account).toBe('0x123')
      })

      // Only one call to getCurrentConnectionData per provider instance
      expect(getCurrentConnectionData).toHaveBeenCalledTimes(2)
    })
  })
})
