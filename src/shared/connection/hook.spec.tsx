import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { ProviderType } from '@dcl/schemas'
import { getCurrentConnectionData, ConnectionData } from './connection'
import { useCurrentConnectionData } from './hook'

// Mock the connection module
jest.mock('./connection')

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
      const { result } = renderHook(() => useCurrentConnectionData())

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
      const { result, waitForNextUpdate } = renderHook(() => useCurrentConnectionData())

      await waitForNextUpdate()

      expect(result.current).toEqual({
        isLoading: false,
        ...mockConnectionData
      })
    })
  })

  describe('when the connection data is null', () => {
    beforeEach(() => {
      ;(getCurrentConnectionData as jest.Mock).mockResolvedValue(null)
    })

    it('should return the initial state where isLoading is false and the other fields are undefined', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useCurrentConnectionData())

      await waitForNextUpdate()

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

  describe('when the component unmounts before the data loads', () => {
    let resolvePromise: (value: ConnectionData) => void
    let controlledPromise: Promise<ConnectionData>

    beforeEach(() => {
      controlledPromise = new Promise(resolve => {
        resolvePromise = resolve
      })
      ;(getCurrentConnectionData as jest.Mock).mockImplementation(() => controlledPromise)
    })

    it('should not update state if the component is unmounted before the data is loaded', async () => {
      const { result, unmount } = renderHook(() => useCurrentConnectionData())

      unmount()

      // Now resolve the promise
      act(() => {
        resolvePromise(mockConnectionData)
      })

      // The state should remain unchanged
      expect(result.current).toEqual({
        isLoading: true,
        account: undefined,
        identity: undefined,
        provider: undefined,
        providerType: undefined,
        chainId: undefined
      })
    })
  })
})
