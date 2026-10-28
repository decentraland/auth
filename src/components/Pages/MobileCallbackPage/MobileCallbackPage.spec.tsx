import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { MobileCallbackPage } from './MobileCallbackPage'

const mockNavigate = jest.fn()
const mockPostIdentity = jest.fn()
const mockGetRedirectResult = jest.fn()
let mockAuthRequestId: string | null = null

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (id: string) => id })
}))

jest.mock('../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

jest.mock('../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [{ explorerText: 'Decentraland' }]
}))

jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackLoginSuccess: jest.fn().mockResolvedValue(undefined) })
}))

jest.mock('../../../shared/auth', () => ({
  createAuthServerHttpClient: () => ({ postIdentity: mockPostIdentity })
}))

jest.mock('../../../shared/connection/identity', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ONE_MONTH_IN_MINUTES: 43200,
  getIdentitySignature: jest.fn().mockResolvedValue({ authChain: [] })
}))

jest.mock('../../../shared/oauthState', () => ({
  getAuthRequestIdFromState: () => mockAuthRequestId,
  getConnectionOptionFromState: () => undefined
}))

jest.mock('../../../shared/utils/magicSdk', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  OAUTH_ACCESS_DENIED_ERROR: 'access_denied',
  createMagicInstance: jest.fn().mockResolvedValue({
    oauth2: { getRedirectResult: () => mockGetRedirectResult() },
    wallet: { getProvider: () => Promise.resolve({ request: () => Promise.resolve(['0xABC']) }) }
  })
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('../MobileAuthPage/MobileAuthSuccess', () => ({
  MobileAuthSuccess: ({ authRequestId }: { authRequestId?: string | null }) => (
    <div data-testid="mobile-auth-success">{authRequestId ?? 'none'}</div>
  )
}))

const AUTH_REQUEST_ID = '13D31E96-1A1A-48EC-AF16-B10C4C982E08'

function renderPage() {
  return render(
    <DclThemeProvider theme={darkTheme}>
      <FeatureFlagsContext.Provider value={{ flags: {}, variants: {}, initialized: true }}>
        <MobileCallbackPage />
      </FeatureFlagsContext.Provider>
    </DclThemeProvider>
  )
}

describe('when the mobile OAuth callback completes', () => {
  beforeEach(() => {
    mockAuthRequestId = AUTH_REQUEST_ID
    mockGetRedirectResult.mockResolvedValue(undefined)
    mockPostIdentity.mockResolvedValue({ identityId: 'identity-id', expiration: new Date() })
  })

  afterEach(() => {
    jest.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  describe('and the OAuth state carries an authRequestId', () => {
    beforeEach(async () => {
      renderPage()
      await screen.findByTestId('mobile-auth-success')
    })

    it('should post the identity with it', () => {
      expect(mockPostIdentity).toHaveBeenCalledWith({ authChain: [] }, { isMobile: true, authRequestId: AUTH_REQUEST_ID })
    })

    it('should hand it to the success deep link', () => {
      expect(screen.getByTestId('mobile-auth-success').textContent).toBe(AUTH_REQUEST_ID)
    })
  })

  describe('and the user cancelled at the provider', () => {
    beforeEach(async () => {
      window.history.replaceState({}, '', '/auth/mobile/callback?error=access_denied')
      renderPage()
      await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    })

    it('should go back to /mobile keeping the authRequestId', () => {
      expect(mockNavigate).toHaveBeenCalledWith(`/mobile?authRequestId=${AUTH_REQUEST_ID}`)
    })
  })

  describe('and the callback fails and the user retries', () => {
    beforeEach(async () => {
      mockGetRedirectResult.mockRejectedValue(new Error('OAuth failed'))
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'common.try_again' }))
    })

    it('should go back to /mobile keeping the authRequestId', () => {
      expect(mockNavigate).toHaveBeenCalledWith(`/mobile?authRequestId=${AUTH_REQUEST_ID}`)
    })
  })
})
