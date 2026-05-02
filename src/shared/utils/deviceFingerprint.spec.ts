import { generateDeviceFingerprint } from './deviceFingerprint'

describe('when generating a device fingerprint', () => {
  let mockDigest: jest.Mock

  beforeEach(() => {
    mockDigest = jest.fn()

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

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when all browser components are available', () => {
    it('should return a hex string hashed with SHA-256', async () => {
      const fingerprint = await generateDeviceFingerprint()
      expect(fingerprint).toBe('abcdef1234567890')
      expect(mockDigest).toHaveBeenCalledTimes(1)
      expect(mockDigest.mock.calls[0][0]).toBe('SHA-256')
    })
  })

  describe('when canvas and WebGL are unavailable', () => {
    it('should return a non-empty string using remaining browser properties', async () => {
      const fingerprint = await generateDeviceFingerprint()
      expect(typeof fingerprint).toBe('string')
      expect(fingerprint.length).toBeGreaterThan(0)
    })
  })

  describe('when the hashing fails completely', () => {
    beforeEach(() => {
      mockDigest.mockRejectedValue(new Error('crypto not available'))
    })

    it('should return an empty string', async () => {
      const fingerprint = await generateDeviceFingerprint()
      expect(fingerprint).toBe('')
    })
  })

  describe('when called multiple times in the same environment', () => {
    it('should produce consistent results', async () => {
      const fp1 = await generateDeviceFingerprint()
      const fp2 = await generateDeviceFingerprint()
      expect(fp1).toBe(fp2)
    })
  })
})
