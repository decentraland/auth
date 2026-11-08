import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { MobileAuthPage } from './MobileAuthPage'
import type { EmailLoginResult } from './MobileEmailLoginModal/MobileEmailLoginModal.types'

const mockPostIdentity = jest.fn()
const mockConnectToProvider = jest.fn()

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (id: string) => id })
}))

jest.mock('decentraland-connect', () => ({
  connection: { disconnect: jest.fn(), tryPreviousConnection: jest.fn() }
}))

jest.mock('../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [{ explorerText: 'Decentraland', connectionOptions: {} }]
}))

jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackLoginClick: jest.fn(), trackLoginSuccess: jest.fn().mockResolvedValue(undefined) })
}))

jest.mock('../../../shared/auth', () => ({
  createAuthServerHttpClient: () => ({ postIdentity: mockPostIdentity })
}))

jest.mock('../../../shared/connection/identity', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ONE_MONTH_IN_MINUTES: 43200,
  getIdentitySignature: jest.fn().mockResolvedValue({ authChain: [] })
}))

jest.mock('../../../shared/thirdweb', () => ({
  disconnectWallet: jest.fn().mockResolvedValue(undefined),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  sendEmailOTP: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../../shared/utils/magicSdk', () => ({
  createMagicInstance: jest.fn().mockResolvedValue({ user: { isLoggedIn: () => Promise.resolve(false) } })
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('../LoginPage/utils', () => ({
  ...jest.requireActual('../LoginPage/utils'),
  connectToProvider: (...args: unknown[]) => mockConnectToProvider(...args),
  connectToSocialProvider: jest.fn()
}))

jest.mock('../../ConnectionModal/ConnectionLayout', () => ({
  ConnectionLayout: () => <div data-testid="connection-layout" />
}))

jest.mock('./MobileProviderSelection', () => ({
  MobileProviderSelection: ({ onEmailSubmit }: { onEmailSubmit: (email: string) => void }) => (
    <button onClick={() => onEmailSubmit('jane.doe@example.com')}>submit email</button>
  )
}))

jest.mock('./MobileEmailLoginModal', () => ({
  MobileEmailLoginModal: ({ open, onSuccess }: { open: boolean; onSuccess: (result: EmailLoginResult) => void }) =>
    open ? (
      <button onClick={() => onSuccess({ address: '0xABC', identity: { authChain: [] } } as unknown as EmailLoginResult)}>
        verify code
      </button>
    ) : null
}))

jest.mock('./MobileAuthSuccess', () => ({
  MobileAuthSuccess: ({ authRequestId }: { authRequestId?: string | null }) => (
    <div data-testid="mobile-auth-success">{authRequestId ?? 'none'}</div>
  )
}))

jest.mock('./testAuth', () => ({
  isTestAuthEmail: () => false,
  sendTestAuthCode: jest.fn()
}))

const AUTH_REQUEST_ID = '13D31E96-1A1A-48EC-AF16-B10C4C982E08'

function renderPage(search: string) {
  return render(
    <DclThemeProvider theme={darkTheme}>
      <FeatureFlagsContext.Provider value={{ flags: {}, variants: {}, initialized: true }}>
        <MemoryRouter initialEntries={[`/mobile${search}`]}>
          <MobileAuthPage />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </DclThemeProvider>
  )
}

describe('when signing in on the mobile page', () => {
  beforeEach(() => {
    mockPostIdentity.mockResolvedValue({ identityId: 'identity-id', expiration: new Date() })
    mockConnectToProvider.mockResolvedValue({ account: '0xABC', provider: {} })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the app opened it with a wallet provider and an authRequestId', () => {
    beforeEach(async () => {
      renderPage(`?provider=metamask&authRequestId=${AUTH_REQUEST_ID}`)
      await screen.findByTestId('mobile-auth-success')
    })

    it('should post the identity with the authRequestId as the app sent it', () => {
      expect(mockPostIdentity).toHaveBeenCalledWith({ authChain: [] }, { isMobile: true, authRequestId: AUTH_REQUEST_ID })
    })

    it('should hand it to the success deep link', () => {
      expect(screen.getByTestId('mobile-auth-success').textContent).toBe(AUTH_REQUEST_ID)
    })
  })

  describe('and the user signs in with email', () => {
    beforeEach(async () => {
      renderPage(`?authRequestId=${AUTH_REQUEST_ID}`)
      fireEvent.click(await screen.findByRole('button', { name: 'submit email' }))
      fireEvent.click(await screen.findByRole('button', { name: 'verify code' }))
      await screen.findByTestId('mobile-auth-success')
    })

    it('should post the identity with the authRequestId', () => {
      expect(mockPostIdentity).toHaveBeenCalledWith({ authChain: [] }, { isMobile: true, authRequestId: AUTH_REQUEST_ID })
    })
  })

  describe('and the authRequestId is not a UUID v4', () => {
    beforeEach(async () => {
      renderPage('?provider=metamask&authRequestId=not-a-uuid')
      await screen.findByTestId('mobile-auth-success')
    })

    it('should post the identity without it', () => {
      expect(mockPostIdentity).toHaveBeenCalledWith({ authChain: [] }, { isMobile: true, authRequestId: null })
    })
  })
})
