import { isClockSynchronized, getClockDifference, isClockSyncError } from './clockSync'

describe('clockSync', () => {
  describe('isClockSynchronized', () => {
    it('should return true when clocks are synchronized within tolerance', () => {
      const serverTimestamp = Date.now()
      expect(isClockSynchronized(serverTimestamp)).toBe(true)
    })

    it('should return true when clock difference is within 5 minutes', () => {
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000
      expect(isClockSynchronized(fourMinutesAgo)).toBe(true)
    })

    it('should return false when clock difference exceeds 5 minutes', () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000
      expect(isClockSynchronized(sixMinutesAgo)).toBe(false)
    })

    it('should respect custom tolerance', () => {
      const threeMinutesAgo = Date.now() - 3 * 60 * 1000
      expect(isClockSynchronized(threeMinutesAgo, 2)).toBe(false)
      expect(isClockSynchronized(threeMinutesAgo, 4)).toBe(true)
    })
  })

  describe('getClockDifference', () => {
    it('should return positive difference when local is ahead', () => {
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000
      expect(getClockDifference(twoMinutesAgo)).toBe(2)
    })

    it('should return negative difference when local is behind', () => {
      const twoMinutesAhead = Date.now() + 2 * 60 * 1000
      expect(getClockDifference(twoMinutesAhead)).toBe(-2)
    })

    it('should return 0 when clocks are synchronized', () => {
      const now = Date.now()
      expect(getClockDifference(now)).toBe(0)
    })
  })

  describe('isClockSyncError', () => {
    describe('when error message indicates clock is behind', () => {
      it('should return true for "the request is not recent enough"', () => {
        const error = new Error('the request is not recent enough')
        expect(isClockSyncError(error)).toBe(true)
      })

      it('should be case insensitive', () => {
        const error = new Error('The Request Is Not Recent Enough')
        expect(isClockSyncError(error)).toBe(true)
      })
    })

    describe('when error message indicates clock is ahead', () => {
      it('should return true for "the request is too far in the future"', () => {
        const error = new Error('the request is too far in the future')
        expect(isClockSyncError(error)).toBe(true)
      })

      it('should be case insensitive', () => {
        const error = new Error('THE REQUEST IS TOO FAR IN THE FUTURE')
        expect(isClockSyncError(error)).toBe(true)
      })
    })

    describe('when error is a string', () => {
      it('should detect clock sync error from string', () => {
        expect(isClockSyncError('the request is not recent enough')).toBe(true)
        expect(isClockSyncError('the request is too far in the future')).toBe(true)
      })
    })

    describe('when error is an object with message', () => {
      it('should detect clock sync error from object', () => {
        expect(isClockSyncError({ message: 'the request is not recent enough' })).toBe(true)
        expect(isClockSyncError({ message: 'the request is too far in the future' })).toBe(true)
      })
    })

    describe('when error is not a clock sync error', () => {
      it('should return false for unrelated errors', () => {
        expect(isClockSyncError(new Error('User rejected'))).toBe(false)
        expect(isClockSyncError(new Error('Network error'))).toBe(false)
        expect(isClockSyncError('some other error')).toBe(false)
      })

      it('should return false for null/undefined', () => {
        expect(isClockSyncError(null)).toBe(false)
        expect(isClockSyncError(undefined)).toBe(false)
      })

      it('should return false for empty message', () => {
        expect(isClockSyncError(new Error(''))).toBe(false)
        expect(isClockSyncError('')).toBe(false)
      })
    })
  })
})
