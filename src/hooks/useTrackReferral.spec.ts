import { renderHook, act } from '@testing-library/react'
import fetch from 'decentraland-crypto-fetch'
import { useCurrentConnectionData } from '../shared/connection'
import { generateDeviceFingerprint } from '../shared/utils/deviceFingerprint'
import { handleErrorWithContext } from '../shared/utils/errorHandler'
import { useTrackReferral } from './useTrackReferral'

jest.mock('decentraland-crypto-fetch', () => jest.fn())

jest.mock('../modules/config', () => ({
  config: { get: jest.fn().mockReturnValue('https://mock-referral-server.com') }
}))

jest.mock('../shared/connection', () => ({
  useCurrentConnectionData: jest.fn()
}))

jest.mock('../shared/utils/deviceFingerprint', () => ({
  generateDeviceFingerprint: jest.fn()
}))

jest.mock('../shared/utils/errorHandler', () => ({
  handleErrorWithContext: jest.fn()
}))

const mockFetch = fetch as jest.MockedFunction<typeof fetch>
const mockUseCurrentConnectionData = useCurrentConnectionData as jest.MockedFunction<typeof useCurrentConnectionData>
const mockGenerateDeviceFingerprint = generateDeviceFingerprint as jest.MockedFunction<typeof generateDeviceFingerprint>

describe('when using the useTrackReferral hook', () => {
  const mockIdentity = {
    ephemeralIdentity: { privateKey: 'pk', publicKey: 'pub', address: '0xuser' },
    expiration: new Date(Date.now() + 3600000),
    authChain: []
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when the identity is available', () => {
    beforeEach(() => {
      mockUseCurrentConnectionData.mockReturnValue({
        identity: mockIdentity,
        account: '0xuser',
        isLoading: false,
        provider: undefined,
        providerType: undefined,
        chainId: undefined,
        getIdentitySignature: jest.fn()
      } as ReturnType<typeof useCurrentConnectionData>)
      mockFetch.mockResolvedValue({} as Response)
      mockGenerateDeviceFingerprint.mockResolvedValue('abc123fingerprint')
    })

    it('should report isReady as true', () => {
      const { result } = renderHook(() => useTrackReferral())
      expect(result.current.isReady).toBe(true)
    })

    describe('when tracking a referral with POST', () => {
      it('should send the device fingerprint header', async () => {
        const { result } = renderHook(() => useTrackReferral())

        await act(async () => {
          await result.current.track('0xreferrer', 'POST')
        })

        expect(mockFetch).toHaveBeenCalledWith(
          'https://mock-referral-server.com/referral-progress',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'x-device-fingerprint': 'abc123fingerprint'
            }),
            body: JSON.stringify({ referrer: '0xreferrer' }),
            identity: mockIdentity
          })
        )
      })
    })

    describe('when tracking a referral with PATCH', () => {
      it('should send the device fingerprint header', async () => {
        const { result } = renderHook(() => useTrackReferral())

        await act(async () => {
          await result.current.track('0xreferrer', 'PATCH')
        })

        expect(mockFetch).toHaveBeenCalledWith(
          'https://mock-referral-server.com/referral-progress',
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              'x-device-fingerprint': 'abc123fingerprint'
            }),
            identity: mockIdentity
          })
        )
      })
    })

    describe('when the device fingerprint is empty', () => {
      beforeEach(() => {
        mockGenerateDeviceFingerprint.mockResolvedValue('')
      })

      it('should omit the device fingerprint header', async () => {
        const { result } = renderHook(() => useTrackReferral())

        await act(async () => {
          await result.current.track('0xreferrer', 'POST')
        })

        expect(mockFetch).toHaveBeenCalledWith(
          'https://mock-referral-server.com/referral-progress',
          expect.objectContaining({
            headers: expect.not.objectContaining({
              'x-device-fingerprint': expect.anything()
            })
          })
        )
      })
    })

    describe('when the fetch request fails', () => {
      let error: Error

      beforeEach(() => {
        error = new Error('Network error')
        mockFetch.mockRejectedValue(error)
      })

      it('should handle the error with context and re-throw', async () => {
        const { result } = renderHook(() => useTrackReferral())

        await expect(result.current.track('0xreferrer')).rejects.toThrow('Network error')
        expect(handleErrorWithContext).toHaveBeenCalledWith(error, 'Failed to track referral progress', expect.any(Object))
      })
    })
  })

  describe('when the identity is not available', () => {
    beforeEach(() => {
      mockUseCurrentConnectionData.mockReturnValue({
        identity: null,
        account: null,
        isLoading: false,
        provider: undefined,
        providerType: undefined,
        chainId: undefined,
        getIdentitySignature: jest.fn()
      } as unknown as ReturnType<typeof useCurrentConnectionData>)
    })

    it('should report isReady as false', () => {
      const { result } = renderHook(() => useTrackReferral())
      expect(result.current.isReady).toBe(false)
    })

    describe('when attempting to track a referral', () => {
      it('should throw an error indicating no identity is available', async () => {
        const { result } = renderHook(() => useTrackReferral())
        await expect(result.current.track('0xreferrer')).rejects.toThrow('No identity available for tracking referral')
      })
    })
  })
})
