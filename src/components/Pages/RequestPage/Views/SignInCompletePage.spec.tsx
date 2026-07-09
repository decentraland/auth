import { config } from '../../../../modules/config'
import { getExplorerDeeplink, getSigninDeeplink } from './SignInCompletePage'

jest.mock('../../../../modules/config', () => ({
  config: {
    get: jest.fn()
  }
}))

const mockedConfigGet = config.get as jest.MockedFunction<typeof config.get>

describe('getExplorerDeeplink', () => {
  let deepLink: string | undefined

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when the environment is production', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('production')
      deepLink = 'decentraland://'
    })

    describe('and bridge-only is disabled', () => {
      it('should return the bare deep link without query params', () => {
        expect(getExplorerDeeplink(deepLink, false)).toBe('decentraland://')
      })
    })

    describe('and bridge-only is enabled', () => {
      it('should append the canonical bridge-only flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('decentraland://?bridge-only=true')
      })
    })
  })

  describe('when the environment is development', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('development')
      deepLink = 'decentraland://'
    })

    describe('and bridge-only is disabled', () => {
      it('should append only the dclenv zone param', () => {
        expect(getExplorerDeeplink(deepLink, false)).toBe('decentraland://?dclenv=zone')
      })
    })

    describe('and bridge-only is enabled', () => {
      it('should append both the dclenv zone param and the bridge-only flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('decentraland://?dclenv=zone&bridge-only=true')
      })
    })
  })

  describe('when the environment is a named non-production env', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('staging')
      deepLink = 'dcl-creator-hub://'
    })

    describe('and bridge-only is enabled', () => {
      it('should append the raw env as dclenv alongside the bridge-only flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('dcl-creator-hub://?dclenv=staging&bridge-only=true')
      })
    })
  })

  describe('when no deep link is provided', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('production')
      deepLink = undefined
    })

    describe('and bridge-only is enabled', () => {
      it('should fall back to the decentraland scheme with the bridge-only flag', () => {
        expect(getExplorerDeeplink(deepLink, true)).toBe('decentraland://?bridge-only=true')
      })
    })
  })
})

describe('getSigninDeeplink', () => {
  let deepLink: string | undefined
  let identityId: string

  beforeEach(() => {
    identityId = 'anIdentityId'
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when the environment is production', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('production')
      deepLink = 'decentraland://'
    })

    describe('and bridge-only is disabled', () => {
      it('should return the signin deep link without extra query params', () => {
        expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=anIdentityId')
      })
    })

    describe('and bridge-only is enabled', () => {
      it('should append the canonical bridge-only flag after the signin param', () => {
        expect(getSigninDeeplink(deepLink, identityId, true)).toBe('decentraland://open?signin=anIdentityId&bridge-only=true')
      })
    })
  })

  describe('when the environment is development', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('development')
      deepLink = 'decentraland://'
    })

    describe('and bridge-only is disabled', () => {
      it('should append only the dclenv zone param after the signin param', () => {
        expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=anIdentityId&dclenv=zone')
      })
    })

    describe('and bridge-only is enabled', () => {
      it('should append both the dclenv zone param and the bridge-only flag after the signin param', () => {
        expect(getSigninDeeplink(deepLink, identityId, true)).toBe('decentraland://open?signin=anIdentityId&dclenv=zone&bridge-only=true')
      })
    })
  })

  describe('when the environment is a named non-production env and a custom scheme is used', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('staging')
      deepLink = 'dcl-creator-hub://'
    })

    it('should build the signin deep link on the custom scheme with the raw env as dclenv', () => {
      expect(getSigninDeeplink(deepLink, identityId, false)).toBe('dcl-creator-hub://open?signin=anIdentityId&dclenv=staging')
    })
  })

  describe('when no deep link is provided', () => {
    beforeEach(() => {
      mockedConfigGet.mockReturnValue('production')
      deepLink = undefined
    })

    it('should fall back to the decentraland scheme', () => {
      expect(getSigninDeeplink(deepLink, identityId, false)).toBe('decentraland://open?signin=anIdentityId')
    })
  })
})
