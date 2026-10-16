import { ConnectionOptionType } from '../../Connection'
import { connectToSocialProvider } from './utils'

const mockLoginWithRedirect = jest.fn()

jest.mock('magic-sdk', () => ({
  Magic: jest.fn().mockImplementation(() => ({
    user: { isLoggedIn: jest.fn().mockResolvedValue(false), logout: jest.fn() },
    oauth2: { loginWithRedirect: mockLoginWithRedirect }
  }))
}))

jest.mock('@magic-ext/oauth2', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  OAuthExtension: jest.fn()
}))

jest.mock('decentraland-connect', () => ({
  ...jest.requireActual('decentraland-connect'),
  connection: { disconnect: jest.fn() },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  getConfiguration: () => ({ magic: { apiKey: 'magic-key' }, magic_test: { apiKey: 'magic-test-key' } })
}))

const AUTH_REQUEST_ID = '13D31E96-1A1A-48EC-AF16-B10C4C982E08'

function sentCustomData(): Record<string, unknown> {
  return JSON.parse(mockLoginWithRedirect.mock.calls[0][0].customData)
}

describe('when starting a mobile social login', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    mockLoginWithRedirect.mockReset()
  })

  describe('and /mobile was opened with a UUID v4 authRequestId', () => {
    beforeEach(async () => {
      window.history.replaceState({}, '', `/auth/mobile?provider=google&authRequestId=${AUTH_REQUEST_ID}`)
      await connectToSocialProvider(ConnectionOptionType.GOOGLE, false, undefined, true)
    })

    it('should carry it in the OAuth state as the app sent it', () => {
      expect(sentCustomData().authRequestId).toBe(AUTH_REQUEST_ID)
    })
  })

  describe('and /mobile was opened with an authRequestId that is not a UUID v4', () => {
    beforeEach(async () => {
      window.history.replaceState({}, '', '/auth/mobile?provider=google&authRequestId=not-a-uuid')
      await connectToSocialProvider(ConnectionOptionType.GOOGLE, false, undefined, true)
    })

    it('should leave it out of the OAuth state', () => {
      expect(sentCustomData()).not.toHaveProperty('authRequestId')
    })
  })
})
