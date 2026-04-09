/* eslint-disable @typescript-eslint/naming-convention, import/order -- mock shapes must match exported names */
import { BrowserRouter } from 'react-router-dom'
import { render, waitFor } from '@testing-library/react'
import type { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { CallbackPage } from './CallbackPage'

// --- Mocks ---

const mockNavigate = jest.fn()
jest.mock('../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

const mockRedirect = jest.fn()
let mockRedirectUrl = 'https://decentraland.org/'
jest.mock('../../../hooks/redirection', () => ({
  useAfterLoginRedirection: () => ({ url: mockRedirectUrl, redirect: mockRedirect })
}))

const mockEnsureProfile = jest.fn()
jest.mock('../../../hooks/useEnsureProfile', () => ({
  useEnsureProfile: () => ({ ensureProfile: mockEnsureProfile })
}))

const mockTrackLoginSuccess = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackLoginSuccess: mockTrackLoginSuccess })
}))

jest.mock('../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [
    {
      skipSetup: true,
      explorerText: 'Decentraland app',
      connectionOptions: {}
    },
    'default'
  ]
}))

const mockGetIdentitySignature = jest.fn()
jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: () => ({
    getIdentitySignature: mockGetIdentitySignature
  })
}))

jest.mock('../../../shared/mobile', () => ({
  isMobileSession: () => false
}))

const mockPostIdentity = jest.fn()
jest.mock('../../../shared/auth', () => ({
  createAuthServerHttpClient: () => ({
    postIdentity: mockPostIdentity
  })
}))

const mockConnect = jest.fn()
jest.mock('decentraland-connect', () => ({
  connection: {
    connect: (...args: unknown[]) => mockConnect(...args)
  }
}))

const mockGetRedirectResult = jest.fn()
jest.mock('../../../shared/utils/magicSdk', () => ({
  OAUTH_ACCESS_DENIED_ERROR: 'access_denied',
  createMagicInstance: () =>
    Promise.resolve({
      oauth2: { getRedirectResult: mockGetRedirectResult }
    })
}))

const mockMarkReturningUser = jest.fn()
jest.mock('../../../shared/onboarding/markReturningUser', () => ({
  markReturningUser: (...args: unknown[]) => mockMarkReturningUser(...args)
}))

jest.mock('../../../shared/onboarding/getStoredEmail', () => ({
  getStoredEmail: jest.fn().mockReturnValue(null)
}))

jest.mock('../../../shared/onboarding/trackCheckpoint', () => ({
  trackCheckpoint: jest.fn()
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: jest.fn()
}))

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('../../ConnectionModal/ConnectionLayout', () => ({
  ConnectionLayout: ({ state }: { state: string }) => <div data-testid="connection-layout" data-state={state} />
}))

jest.mock('./CallbackPage.styled', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return { Container: Div, Wrapper: Div }
})

jest.mock('../MobileCallbackPage/MobileCallbackPage', () => ({
  MobileCallbackPage: () => <div data-testid="mobile-callback" />
}))

jest.mock('../../FeatureFlagsProvider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createContext } = require('react')
  return {
    FeatureFlagsContext: createContext({
      flags: {},
      variants: {},
      initialized: true
    }),
    FeatureFlagsKeys: {
      MAGIC_TEST: 'dapps-magic-dev-test',
      OPEN_EXPLORER_AFTER_LOGIN: 'dapps-open-explorer-after-login'
    }
  }
})

jest.mock('decentraland-ui2', () => ({
  CircularProgress: () => null
}))

// --- Helpers ---

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FeatureFlagsContext } = require('../../FeatureFlagsProvider')

const createMockIdentity = (): AuthIdentity =>
  ({
    ephemeralIdentity: {
      privateKey: '0x' + 'a'.repeat(64),
      publicKey: '0x' + 'b'.repeat(130),
      address: '0x' + 'c'.repeat(40)
    },
    expiration: new Date(Date.now() + 60_000),
    authChain: []
  }) as unknown as AuthIdentity

interface RenderOptions {
  flags?: Record<string, boolean>
  redirectUrl?: string
}

const renderWithProviders = ({ flags = {}, redirectUrl = 'https://decentraland.org/' }: RenderOptions = {}) => {
  mockRedirectUrl = redirectUrl
  return render(
    <BrowserRouter>
      <FeatureFlagsContext.Provider value={{ flags, variants: {}, initialized: true }}>
        <CallbackPage />
      </FeatureFlagsContext.Provider>
    </BrowserRouter>
  )
}

// --- Tests ---

describe('CallbackPage', () => {
  beforeEach(() => {
    mockGetRedirectResult.mockResolvedValue({ oauth: { userInfo: {} } })
    mockConnect.mockResolvedValue({
      account: '0xTestAccount',
      provider: {},
      providerType: 'magic'
    })
    mockGetIdentitySignature.mockResolvedValue(createMockIdentity())
    mockTrackLoginSuccess.mockResolvedValue(undefined)
    mockEnsureProfile.mockResolvedValue({ avatars: [{}] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when the OPEN_EXPLORER_AFTER_LOGIN flag is enabled', () => {
    const mockIdentity = createMockIdentity()

    beforeEach(() => {
      ;(localStorageGetIdentity as jest.Mock).mockReturnValue(mockIdentity)
      mockPostIdentity.mockResolvedValue({ identityId: 'test-identity-id' })
    })

    it('should post the identity to the auth server', async () => {
      renderWithProviders({ flags: { 'dapps-open-explorer-after-login': true } })

      await waitFor(() => {
        expect(mockPostIdentity).toHaveBeenCalledWith(mockIdentity, { isMobile: false })
      })
    })

    it('should navigate to the open explorer page with the identity id', async () => {
      renderWithProviders({ flags: { 'dapps-open-explorer-after-login': true } })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/open-explorer?identityId=test-identity-id'),
          { replace: true }
        )
      })
    })

    it('should not call redirect', async () => {
      renderWithProviders({ flags: { 'dapps-open-explorer-after-login': true } })

      await waitFor(() => {
        expect(mockPostIdentity).toHaveBeenCalled()
      })

      expect(mockRedirect).not.toHaveBeenCalled()
    })

    it('should mark the user as returning', async () => {
      renderWithProviders({ flags: { 'dapps-open-explorer-after-login': true } })

      await waitFor(() => {
        expect(mockMarkReturningUser).toHaveBeenCalledWith('0xTestAccount')
      })
    })
  })

  describe('when the OPEN_EXPLORER_AFTER_LOGIN flag is disabled', () => {
    it('should not post the identity to the auth server', async () => {
      renderWithProviders()

      await waitFor(() => {
        expect(mockRedirect).toHaveBeenCalled()
      })

      expect(mockPostIdentity).not.toHaveBeenCalled()
    })

    it('should call redirect', async () => {
      renderWithProviders()

      await waitFor(() => {
        expect(mockRedirect).toHaveBeenCalled()
      })
    })
  })

  describe('when the OPEN_EXPLORER_AFTER_LOGIN flag is enabled and redirectTo has an explicit path', () => {
    const mockIdentity = createMockIdentity()

    beforeEach(() => {
      ;(localStorageGetIdentity as jest.Mock).mockReturnValue(mockIdentity)
      mockPostIdentity.mockResolvedValue({ identityId: 'test-identity-id' })
    })

    it('should redirect instead of opening the deep link', async () => {
      renderWithProviders({
        flags: { 'dapps-open-explorer-after-login': true },
        redirectUrl: 'https://decentraland.org/marketplace'
      })

      await waitFor(() => {
        expect(mockRedirect).toHaveBeenCalled()
      })

      expect(mockPostIdentity).not.toHaveBeenCalled()
    })
  })

  describe('when the OPEN_EXPLORER_AFTER_LOGIN flag is enabled but identity is not in localStorage', () => {
    beforeEach(() => {
      ;(localStorageGetIdentity as jest.Mock).mockReturnValue(null)
    })

    it('should fall through to the normal redirect flow', async () => {
      renderWithProviders({ flags: { 'dapps-open-explorer-after-login': true } })

      await waitFor(() => {
        expect(mockRedirect).toHaveBeenCalled()
      })

      expect(mockPostIdentity).not.toHaveBeenCalled()
    })
  })

  describe('when the OAuth provider returns an access_denied error', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '?error=access_denied', href: 'http://localhost/auth/callback?error=access_denied' },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '', href: 'http://localhost/auth/callback' },
        writable: true,
        configurable: true
      })
    })

    it('should navigate back to the login page', async () => {
      renderWithProviders()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login'), { replace: true })
      })
    })
  })
})
