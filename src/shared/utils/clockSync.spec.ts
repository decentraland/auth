import { MAX_CLOCK_AHEAD_MS, MAX_CLOCK_BEHIND_MS, checkClockSync, isClockSynchronized } from './clockSync'

const mockCheckHealth = jest.fn()

jest.mock('../auth', () => ({
  createAuthServerHttpClient: () => ({ checkHealth: mockCheckHealth })
}))

const NOW = 1_791_587_754_717

describe('isClockSynchronized', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('when the local clock matches the server', () => {
    it('should report it as synchronized', () => {
      expect(isClockSynchronized(NOW)).toBe(true)
    })
  })

  describe('when the local clock is behind the server', () => {
    it('should report it as synchronized up to the behind tolerance', () => {
      expect(isClockSynchronized(NOW + MAX_CLOCK_BEHIND_MS)).toBe(true)
    })

    it('should report it as out of sync past the behind tolerance', () => {
      expect(isClockSynchronized(NOW + MAX_CLOCK_BEHIND_MS + 1)).toBe(false)
    })

    it('should report a clock 182s behind as out of sync, since the auth server rejects its signed requests', () => {
      expect(isClockSynchronized(NOW + 182_392)).toBe(false)
    })
  })

  describe('when the local clock is ahead of the server', () => {
    it('should report it as synchronized up to the ahead tolerance', () => {
      expect(isClockSynchronized(NOW - MAX_CLOCK_AHEAD_MS)).toBe(true)
    })

    it('should report it as out of sync past the ahead tolerance', () => {
      expect(isClockSynchronized(NOW - MAX_CLOCK_AHEAD_MS - 1)).toBe(false)
    })
  })
})

describe('checkClockSync', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW)
    mockCheckHealth.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('when the server clock is ahead by more than the behind tolerance', () => {
    beforeEach(() => {
      mockCheckHealth.mockResolvedValue({ timestamp: NOW + 182_392 })
    })

    it('should resolve false', async () => {
      await expect(checkClockSync()).resolves.toBe(false)
    })
  })

  describe('when the server clock is within tolerance', () => {
    beforeEach(() => {
      mockCheckHealth.mockResolvedValue({ timestamp: NOW + 1_000 })
    })

    it('should resolve true', async () => {
      await expect(checkClockSync()).resolves.toBe(true)
    })
  })

  describe('when the health response has no numeric timestamp', () => {
    beforeEach(() => {
      mockCheckHealth.mockResolvedValue({})
    })

    it('should fail open and resolve true', async () => {
      await expect(checkClockSync()).resolves.toBe(true)
    })
  })

  describe('when the health check fails', () => {
    beforeEach(() => {
      mockCheckHealth.mockRejectedValue(new Error('Health check failed with status: 503'))
    })

    it('should fail open and resolve true', async () => {
      await expect(checkClockSync()).resolves.toBe(true)
    })
  })
})
