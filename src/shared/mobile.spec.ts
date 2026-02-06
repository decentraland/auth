import { isMobileSession, getMobileSession, MobileSession } from './mobile'

const MOBILE_SESSION_KEY = 'auth-mobile-session'

function setLocation(pathname: string, search = '') {
  Object.defineProperty(window, 'location', {
    value: { pathname, search },
    writable: true
  })
}

describe('mobile session', () => {
  beforeEach(() => {
    localStorage.clear()
    setLocation('/auth/login')
  })

  describe('isMobileSession', () => {
    describe('on /auth/mobile with params', () => {
      it('should return true and persist session', () => {
        setLocation('/auth/mobile', '?u=user123&s=session456')
        expect(isMobileSession()).toBe(true)

        const stored: MobileSession = JSON.parse(localStorage.getItem(MOBILE_SESSION_KEY)!)
        expect(stored.u).toBe('user123')
        expect(stored.s).toBe('session456')
        expect(stored.t).toBeGreaterThan(0)
      })

      it('should work with subpaths like /auth/mobile/callback', () => {
        setLocation('/auth/mobile/callback', '?u=user1&s=sess1')
        expect(isMobileSession()).toBe(true)
        expect(localStorage.getItem(MOBILE_SESSION_KEY)).not.toBeNull()
      })
    })

    describe('on /auth/mobile without params', () => {
      it('should return true and keep existing recent session', () => {
        const session: MobileSession = { t: Date.now(), u: 'prev-user', s: 'prev-sess' }
        localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session))

        setLocation('/auth/mobile')
        expect(isMobileSession()).toBe(true)

        const stored: MobileSession = JSON.parse(localStorage.getItem(MOBILE_SESSION_KEY)!)
        expect(stored.u).toBe('prev-user')
      })

      it('should return true and remove expired session', () => {
        const session: MobileSession = { t: Date.now() - 11 * 60 * 1000, u: 'old-user', s: 'old-sess' }
        localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session))

        setLocation('/auth/mobile')
        expect(isMobileSession()).toBe(true)
        expect(localStorage.getItem(MOBILE_SESSION_KEY)).toBeNull()
      })

      it('should return true even with no previous session', () => {
        setLocation('/auth/mobile')
        expect(isMobileSession()).toBe(true)
      })
    })

    describe('on other routes', () => {
      it('should return true if a recent session exists', () => {
        const session: MobileSession = { t: Date.now(), u: 'user1', s: 'sess1' }
        localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session))

        setLocation('/auth/callback')
        expect(isMobileSession()).toBe(true)
      })

      it('should return false and clean up if session is expired', () => {
        const session: MobileSession = { t: Date.now() - 11 * 60 * 1000, u: 'user1', s: 'sess1' }
        localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session))

        setLocation('/auth/callback')
        expect(isMobileSession()).toBe(false)
        expect(localStorage.getItem(MOBILE_SESSION_KEY)).toBeNull()
      })

      it('should return false if no session exists', () => {
        setLocation('/auth/login')
        expect(isMobileSession()).toBe(false)
      })
    })

    describe('corrupted localStorage', () => {
      it('should return false and clean up on other routes', () => {
        localStorage.setItem(MOBILE_SESSION_KEY, 'not-json')

        setLocation('/auth/callback')
        expect(isMobileSession()).toBe(false)
        expect(localStorage.getItem(MOBILE_SESSION_KEY)).toBeNull()
      })

      it('should return true and clean up on /auth/mobile without params', () => {
        localStorage.setItem(MOBILE_SESSION_KEY, 'not-json')

        setLocation('/auth/mobile')
        expect(isMobileSession()).toBe(true)
        expect(localStorage.getItem(MOBILE_SESSION_KEY)).toBeNull()
      })
    })
  })

  describe('getMobileSession', () => {
    it('should return the session if it exists', () => {
      const session: MobileSession = { t: Date.now(), u: 'user1', s: 'sess1' }
      localStorage.setItem(MOBILE_SESSION_KEY, JSON.stringify(session))

      const result = getMobileSession()
      expect(result).toEqual(session)
    })

    it('should return null if no session exists', () => {
      expect(getMobileSession()).toBeNull()
    })

    it('should return null on corrupted data', () => {
      localStorage.setItem(MOBILE_SESSION_KEY, 'not-json')
      expect(getMobileSession()).toBeNull()
    })
  })
})
