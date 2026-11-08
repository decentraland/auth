import { act, render } from '@testing-library/react'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { MobileAuthSuccess } from './MobileAuthSuccess'

const mockLaunchDeepLink = jest.fn()

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (id: string) => id })
}))

jest.mock('../RequestPage/utils', () => ({
  ...jest.requireActual('../RequestPage/utils'),
  launchDeepLink: (url: string) => mockLaunchDeepLink(url)
}))

const IDENTITY_ID = 'f0963d93-f520-4612-9714-8d0d30f7ae6d'
const AUTH_REQUEST_ID = '13d31e96-1a1a-48ec-af16-b10c4c982e08'

describe('when the mobile sign in succeeds', () => {
  let authRequestId: string | null

  beforeEach(() => {
    jest.useFakeTimers()
    mockLaunchDeepLink.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.useRealTimers()
    mockLaunchDeepLink.mockReset()
  })

  describe('and the app sent an authRequestId', () => {
    beforeEach(async () => {
      authRequestId = AUTH_REQUEST_ID
      render(
        <DclThemeProvider theme={darkTheme}>
          <MobileAuthSuccess identityId={IDENTITY_ID} authRequestId={authRequestId} explorerText="Decentraland" onTryAgain={jest.fn()} />
        </DclThemeProvider>
      )
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })
    })

    it('should launch the signin deep link carrying it', () => {
      const url = new URL(mockLaunchDeepLink.mock.calls[0][0])
      expect({ signin: url.searchParams.get('signin'), authRequestId: url.searchParams.get('authRequestId') }).toEqual({
        signin: IDENTITY_ID,
        authRequestId: AUTH_REQUEST_ID
      })
    })
  })

  describe('and the app sent no authRequestId', () => {
    beforeEach(async () => {
      authRequestId = null
      render(
        <DclThemeProvider theme={darkTheme}>
          <MobileAuthSuccess identityId={IDENTITY_ID} authRequestId={authRequestId} explorerText="Decentraland" onTryAgain={jest.fn()} />
        </DclThemeProvider>
      )
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })
    })

    it('should launch the signin deep link without it', () => {
      expect(new URL(mockLaunchDeepLink.mock.calls[0][0]).searchParams.has('authRequestId')).toBe(false)
    })
  })
})
