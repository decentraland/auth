import { ConnectionOptionType } from '../components/Connection'
import { getConnectionOptionFromState, getMobileSession, isMobileSession, resetMobileSession } from './mobile'

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
    resetMobileSession()
    setLocation('/auth/login')
  })

  describe('isMobileSession', () => {
    describe('on /auth/mobile', () => {
      describe('when there are query parameters', () => {
        beforeEach(() => {
          setLocation('/auth/mobile', '?u=user123&s=session456')
        })

        it('should return true', () => {
          expect(isMobileSession()).toBe(true)
        })
      })

      describe('when there are no query parameters', () => {
        beforeEach(() => {
          setLocation('/auth/mobile')
        })

        it('should return true', () => {
          expect(isMobileSession()).toBe(true)
        })
      })

      describe('when having an extra path', () => {
        beforeEach(() => {
          setLocation('/auth/mobile/callback', '?u=user1&s=sess1')
        })

        it('should return true', () => {
          expect(isMobileSession()).toBe(true)
        })
      })
    })

    describe('on /auth/callback with state param', () => {
      describe('when isMobileFlow is true in state', () => {
        beforeEach(() => {
          const state = makeState({ isMobileFlow: true, mobileUserId: 'u1', mobileSessionId: 's1' })
          setLocation('/auth/callback', `?state=${state}`)
        })

        it('should return true', () => {
          expect(isMobileSession()).toBe(true)
        })
      })

      describe('when isMobileFlow is false in state', () => {
        beforeEach(() => {
          const state = makeState({ isMobileFlow: false })
          setLocation('/auth/callback', `?state=${state}`)
        })

        it('should return false', () => {
          expect(isMobileSession()).toBe(false)
        })
      })

      describe('when isMobileFlow is missing from state', () => {
        beforeEach(() => {
          const state = makeState({ redirectTo: '/somewhere' })
          setLocation('/auth/callback', `?state=${state}`)
        })

        it('should return false', () => {
          expect(isMobileSession()).toBe(false)
        })
      })
    })

    describe('on other routes without state', () => {
      beforeEach(() => {
        setLocation('/auth/login')
      })

      it('should return false', () => {
        expect(isMobileSession()).toBe(false)
      })
    })

    describe('malformed state', () => {
      describe('when state is invalid base64', () => {
        beforeEach(() => {
          setLocation('/auth/callback', '?state=not-base64!!!')
        })

        it('should return false', () => {
          expect(isMobileSession()).toBe(false)
        })
      })

      describe('when state is non-JSON', () => {
        beforeEach(() => {
          setLocation('/auth/callback', `?state=${btoa('not-json')}`)
        })

        it('should return false', () => {
          expect(isMobileSession()).toBe(false)
        })
      })

      describe('when state has no customData', () => {
        beforeEach(() => {
          setLocation('/auth/callback', `?state=${btoa(JSON.stringify({ other: 'data' }))}`)
        })

        it('should return false', () => {
          expect(isMobileSession()).toBe(false)
        })
      })
    })
  })

  describe('getMobileSession', () => {
    describe('on /auth/mobile', () => {
      describe('when both u and s params are present', () => {
        beforeEach(() => {
          setLocation('/auth/mobile', '?u=user123&s=session456')
        })

        it('should return session from URL params', () => {
          expect(getMobileSession()).toEqual({ u: 'user123', s: 'session456' })
        })
      })

      describe('when only u param is present', () => {
        beforeEach(() => {
          setLocation('/auth/mobile', '?u=user123')
        })

        it('should return session with undefined s', () => {
          expect(getMobileSession()).toEqual({ u: 'user123', s: undefined })
        })
      })

      describe('when no params are present', () => {
        beforeEach(() => {
          setLocation('/auth/mobile')
        })

        it('should return session with undefined fields', () => {
          expect(getMobileSession()).toEqual({ u: undefined, s: undefined })
        })
      })
    })

    describe('on /auth/callback with state param', () => {
      describe('when isMobileFlow is true with mobile data', () => {
        beforeEach(() => {
          const state = makeState({ isMobileFlow: true, mobileUserId: 'u1', mobileSessionId: 's1' })
          setLocation('/auth/callback', `?state=${state}`)
        })

        it('should return session from state', () => {
          expect(getMobileSession()).toEqual({ u: 'u1', s: 's1' })
        })
      })

      describe('when isMobileFlow is true without mobile data', () => {
        beforeEach(() => {
          const state = makeState({ isMobileFlow: true })
          setLocation('/auth/callback', `?state=${state}`)
        })

        it('should return session with undefined fields', () => {
          expect(getMobileSession()).toEqual({ u: undefined, s: undefined })
        })
      })

      describe('when isMobileFlow is false', () => {
        beforeEach(() => {
          const state = makeState({ isMobileFlow: false, mobileUserId: 'u1' })
          setLocation('/auth/callback', `?state=${state}`)
        })

        it('should return null', () => {
          expect(getMobileSession()).toBeNull()
        })
      })
    })

    describe('on other routes', () => {
      beforeEach(() => {
        setLocation('/auth/login')
      })

      it('should return null', () => {
        expect(getMobileSession()).toBeNull()
      })
    })

    describe('malformed state', () => {
      describe('when state is invalid', () => {
        beforeEach(() => {
          setLocation('/auth/callback', '?state=garbage')
        })

        it('should return null', () => {
          expect(getMobileSession()).toBeNull()
        })
      })
    })
  })

  describe('getConnectionOptionFromState', () => {
    describe('when state has a known connectionOption', () => {
      beforeEach(() => {
        const state = makeState({ connectionOption: ConnectionOptionType.GOOGLE })
        setLocation('/auth/callback', `?state=${state}`)
      })

      it('should return the ConnectionOptionType value', () => {
        expect(getConnectionOptionFromState()).toBe(ConnectionOptionType.GOOGLE)
      })
    })

    describe('when state has an unknown connectionOption', () => {
      beforeEach(() => {
        const state = makeState({ connectionOption: 'not-a-real-option' })
        setLocation('/auth/callback', `?state=${state}`)
      })

      it('should return undefined to prevent typos leaking into tracking', () => {
        expect(getConnectionOptionFromState()).toBeUndefined()
      })
    })

    describe('when state has no connectionOption field', () => {
      beforeEach(() => {
        const state = makeState({ isMobileFlow: true })
        setLocation('/auth/callback', `?state=${state}`)
      })

      it('should return undefined', () => {
        expect(getConnectionOptionFromState()).toBeUndefined()
      })
    })

    describe('when there is no state param', () => {
      beforeEach(() => {
        setLocation('/auth/callback')
      })

      it('should return undefined', () => {
        expect(getConnectionOptionFromState()).toBeUndefined()
      })
    })

    describe('when state is malformed', () => {
      beforeEach(() => {
        setLocation('/auth/callback', '?state=not-base64!!!')
      })

      it('should return undefined', () => {
        expect(getConnectionOptionFromState()).toBeUndefined()
      })
    })

    describe('caching across reads', () => {
      beforeEach(() => {
        const state = makeState({ connectionOption: ConnectionOptionType.DISCORD })
        setLocation('/auth/callback', `?state=${state}`)
      })

      it('should still return the option after the state param has been stripped from the URL', () => {
        // First read populates the in-memory cache while the state param is present
        expect(getConnectionOptionFromState()).toBe(ConnectionOptionType.DISCORD)

        // Simulate Magic's getRedirectResult() wiping the query string
        setLocation('/auth/callback', '')

        expect(getConnectionOptionFromState()).toBe(ConnectionOptionType.DISCORD)
      })
    })
  })
})
