import { ConnectionOptionType } from '../components/Connection'
import { getConnectionOptionFromState, resetOauthStateCache } from './oauthState'

function setLocation(pathname: string, search = '') {
  Object.defineProperty(window, 'location', {
    value: { pathname, search },
    writable: true
  })
}

function makeState(customData: Record<string, unknown>): string {
  return btoa(JSON.stringify({ customData: JSON.stringify(customData) }))
}

describe('oauth state', () => {
  beforeEach(() => {
    resetOauthStateCache()
    setLocation('/auth/login')
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
