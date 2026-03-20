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

describe('useTrackReferral', () => {
  const mockIdentity = {
    ephemeralIdentity: { privateKey: 'pk', publicKey: 'pub', address: '0xuser' },
    expiration: new Date(Date.now() + 3600000),
    authChain: []
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCurrentConnectionData.mockReturnValue({
      identity: mockIdentity,
      account: '0xuser'
    } as ReturnType<typeof useCurrentConnectionData>)
    mockFetch.mockResolvedValue({} as Response)
    mockGenerateDeviceFingerprint.mockResolvedValue('abc123fingerprint')
  })

  it('should send the device fingerprint header on POST', async () => {
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

  it('should send the device fingerprint header on PATCH', async () => {
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

  it('should omit device fingerprint header when fingerprint is empty', async () => {
    mockGenerateDeviceFingerprint.mockResolvedValue('')

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

  it('should throw when identity is not available', async () => {
    mockUseCurrentConnectionData.mockReturnValue({
      identity: null,
      account: null
    } as unknown as ReturnType<typeof useCurrentConnectionData>)

    const { result } = renderHook(() => useTrackReferral())

    await expect(result.current.track('0xreferrer')).rejects.toThrow('No identity available for tracking referral')
  })

  it('should handle fetch errors and re-throw', async () => {
    const error = new Error('Network error')
    mockFetch.mockRejectedValue(error)

    const { result } = renderHook(() => useTrackReferral())

    await expect(result.current.track('0xreferrer')).rejects.toThrow('Network error')
    expect(handleErrorWithContext).toHaveBeenCalledWith(error, 'Failed to track referral progress', expect.any(Object))
  })

  it('should report isReady as true when identity exists', () => {
    const { result } = renderHook(() => useTrackReferral())
    expect(result.current.isReady).toBe(true)
  })

  it('should report isReady as false when identity is null', () => {
    mockUseCurrentConnectionData.mockReturnValue({
      identity: null,
      account: null
    } as unknown as ReturnType<typeof useCurrentConnectionData>)

    const { result } = renderHook(() => useTrackReferral())
    expect(result.current.isReady).toBe(false)
  })
})
