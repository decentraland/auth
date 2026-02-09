import { isMobileSession, getMobileSession } from './mobile'

function setLocation(pathname: string, search = '') {
  Object.defineProperty(window, 'location', {
    value: { pathname, search },
    writable: true
  })
}

function makeState(customData: Record<string, unknown>): string {
  return btoa(JSON.stringify({ customData: JSON.stringify(customData) }))
}

describe('mobile session', () => {
  beforeEach(() => {
    setLocation('/auth/login')
  })

  describe('isMobileSession', () => {
    describe('on /auth/mobile', () => {
      it('should return true with params', () => {
        setLocation('/auth/mobile', '?u=user123&s=session456')
        expect(isMobileSession()).toBe(true)
      })

      it('should return true without params', () => {
        setLocation('/auth/mobile')
        expect(isMobileSession()).toBe(true)
      })

      it('should return true for subpaths like /auth/mobile/callback', () => {
        setLocation('/auth/mobile/callback', '?u=user1&s=sess1')
        expect(isMobileSession()).toBe(true)
      })
    })

    describe('on /auth/callback with state param', () => {
      it('should return true when isMobileFlow is true in state', () => {
        const state = makeState({ isMobileFlow: true, mobileUserId: 'u1', mobileSessionId: 's1' })
        setLocation('/auth/callback', `?state=${state}`)
        expect(isMobileSession()).toBe(true)
      })

      it('should return false when isMobileFlow is false in state', () => {
        const state = makeState({ isMobileFlow: false })
        setLocation('/auth/callback', `?state=${state}`)
        expect(isMobileSession()).toBe(false)
      })

      it('should return false when isMobileFlow is missing from state', () => {
        const state = makeState({ redirectTo: '/somewhere' })
        setLocation('/auth/callback', `?state=${state}`)
        expect(isMobileSession()).toBe(false)
      })
    })

    describe('on other routes without state', () => {
      it('should return false', () => {
        setLocation('/auth/login')
        expect(isMobileSession()).toBe(false)
      })
    })

    describe('malformed state', () => {
      it('should return false for invalid base64', () => {
        setLocation('/auth/callback', '?state=not-base64!!!')
        expect(isMobileSession()).toBe(false)
      })

      it('should return false for non-JSON state', () => {
        setLocation('/auth/callback', `?state=${btoa('not-json')}`)
        expect(isMobileSession()).toBe(false)
      })

      it('should return false for state without customData', () => {
        setLocation('/auth/callback', `?state=${btoa(JSON.stringify({ other: 'data' }))}`)
        expect(isMobileSession()).toBe(false)
      })
    })
  })

  describe('getMobileSession', () => {
    describe('on /auth/mobile', () => {
      it('should return session from URL params', () => {
        setLocation('/auth/mobile', '?u=user123&s=session456')
        expect(getMobileSession()).toEqual({ u: 'user123', s: 'session456' })
      })

      it('should return session with only u param', () => {
        setLocation('/auth/mobile', '?u=user123')
        expect(getMobileSession()).toEqual({ u: 'user123', s: undefined })
      })

      it('should return session with undefined fields when no params', () => {
        setLocation('/auth/mobile')
        expect(getMobileSession()).toEqual({ u: undefined, s: undefined })
      })
    })

    describe('on /auth/callback with state param', () => {
      it('should return session from state when isMobileFlow is true', () => {
        const state = makeState({ isMobileFlow: true, mobileUserId: 'u1', mobileSessionId: 's1' })
        setLocation('/auth/callback', `?state=${state}`)
        expect(getMobileSession()).toEqual({ u: 'u1', s: 's1' })
      })

      it('should return session with undefined fields when missing from state', () => {
        const state = makeState({ isMobileFlow: true })
        setLocation('/auth/callback', `?state=${state}`)
        expect(getMobileSession()).toEqual({ u: undefined, s: undefined })
      })

      it('should return null when isMobileFlow is false', () => {
        const state = makeState({ isMobileFlow: false, mobileUserId: 'u1' })
        setLocation('/auth/callback', `?state=${state}`)
        expect(getMobileSession()).toBeNull()
      })
    })

    describe('on other routes', () => {
      it('should return null when no state param', () => {
        setLocation('/auth/login')
        expect(getMobileSession()).toBeNull()
      })
    })

    describe('malformed state', () => {
      it('should return null for invalid state', () => {
        setLocation('/auth/callback', '?state=garbage')
        expect(getMobileSession()).toBeNull()
      })
    })
  })
})
