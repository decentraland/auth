import { generateDeviceFingerprint } from './deviceFingerprint'

describe('generateDeviceFingerprint', () => {
  const mockDigest = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock crypto.subtle.digest to return a predictable hash
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          digest: mockDigest
        }
      },
      writable: true,
      configurable: true
    })

    mockDigest.mockResolvedValue(new Uint8Array([0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90]).buffer)
  })

  it('should return a hex string when all components are available', async () => {
    const fingerprint = await generateDeviceFingerprint()
    expect(fingerprint).toBe('abcdef1234567890')
    expect(mockDigest).toHaveBeenCalledTimes(1)
    expect(mockDigest.mock.calls[0][0]).toBe('SHA-256')
  })

  it('should return a non-empty string even when canvas and WebGL are unavailable', async () => {
    // In jsdom, canvas context returns null and WebGL is not available,
    // but screen info and browser properties still provide data
    const fingerprint = await generateDeviceFingerprint()
    expect(typeof fingerprint).toBe('string')
    expect(fingerprint.length).toBeGreaterThan(0)
  })

  it('should return empty string if hashing fails completely', async () => {
    mockDigest.mockRejectedValue(new Error('crypto not available'))

    const fingerprint = await generateDeviceFingerprint()
    expect(fingerprint).toBe('')
  })

  it('should produce consistent results for the same environment', async () => {
    const fp1 = await generateDeviceFingerprint()
    const fp2 = await generateDeviceFingerprint()
    expect(fp1).toBe(fp2)
  })
})
