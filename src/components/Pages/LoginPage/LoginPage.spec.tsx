import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthIdentity } from '@dcl/crypto'
import { ConnectionResponse } from 'decentraland-connect'
import { checkClockSync } from '../../../shared/utils/clockSync'
import { ConnectionOptionType } from '../../Connection'
import { LoginPage } from './LoginPage'

const mockCheckClockSync = checkClockSync as jest.Mock

// --- Mocks ---

const mockRedirect = jest.fn()
jest.mock('../../../hooks/redirection', () => ({
  useAfterLoginRedirection: () => ({ url: 'https://decentraland.org/', redirect: mockRedirect })
}))

const mockEnsureProfile = jest.fn()
jest.mock('../../../hooks/useEnsureProfile', () => ({
  useEnsureProfile: () => ({ ensureProfile: mockEnsureProfile })
}))

const mockGetIdentitySignature = jest.fn()
let mockContextIdentity: AuthIdentity | undefined
jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: () => ({
    get identity() {
      return mockContextIdentity
    },
    getIdentitySignature: mockGetIdentitySignature
  })
}))

jest.mock('../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [
    {
      skipSetup: false,
      showWearablePreview: true,
      explorerText: 'Decentraland app',
      connectionOptions: {
        primary: 'email',
        secondary: 'metamask',
        extraOptions: []
      }
    },
    'default'
  ]
}))

const mockTrackLoginClick = jest.fn()
const mockTrackLoginSuccess = jest.fn().mockResolvedValue(undefined)
const mockTrackGuestLogin = jest.fn()
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackLoginClick: mockTrackLoginClick,
    trackLoginSuccess: mockTrackLoginSuccess,
    trackGuestLogin: mockTrackGuestLogin
  })
}))

jest.mock('../../../hooks/useAutoLogin', () => ({
  useAutoLogin: () => ({ loginMethod: null, autoLoginTriggered: false, resolvedConnectionOption: null })
}))

const mockConnectToProvider = jest.fn()
jest.mock('./utils', () => ({
  connectToProvider: (...args: unknown[]) => mockConnectToProvider(...args),
  connectToSocialProvider: jest.fn(),
  fromConnectionOptionToProviderType: jest.fn().mockReturnValue('injected'),
  isMagicTestMode: jest.fn().mockReturnValue(false),
  isSocialLogin: jest.fn().mockReturnValue(false),
  requiresInjectedProvider: jest.fn().mockReturnValue(true),
  getSignInOptionsMode: jest.fn().mockReturnValue('full')
}))

jest.mock('../../../shared/auth', () => ({
  createAuthServerHttpClient: () => ({
    checkHealth: jest.fn().mockResolvedValue({ timestamp: Date.now() })
  })
}))

jest.mock('../../WalletErrorModal', () => ({
  WalletErrorModal: () => null
}))

jest.mock('../../../shared/utils/clockSync', () => ({
  isClockSynchronized: jest.fn(),
  checkClockSync: jest.fn().mockResolvedValue(true)
}))

jest.mock('../../../shared/onboarding/trackCheckpoint', () => ({
  trackCheckpoint: jest.fn(),
  trackCheckpointWhenReady: jest.fn()
}))

jest.mock('../../../shared/thirdweb', () => ({
  disconnectWallet: jest.fn().mockResolvedValue(undefined),
  // eslint-disable-next-line @typescript-eslint/naming-convention -- matches exported name
  sendEmailOTP: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('../../../shared/errors', () => ({
  isErrorWithName: jest.fn().mockReturnValue(false),
  isUserRejectedTransaction: jest.fn().mockReturnValue(false)
}))

jest.mock('../../../shared/locations', () => ({
  extractReferrerFromSearchParameters: jest.fn().mockReturnValue(null)
}))

jest.mock('../../FeatureFlagsProvider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createContext } = require('react')
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    FeatureFlagsContext: {
      ...createContext({
        flags: {},
        variants: {},
        initialized: true
      })
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    FeatureFlagsKeys: { MAGIC_TEST: 'dapps-magic-dev-test' }
  }
})

jest.mock('../../ClockSyncModal', () => ({
  ClockSyncModal: () => null
}))

jest.mock('../../ConnectionModal', () => ({
  ConnectionModal: () => null
}))

jest.mock('../../EmailLoginModal', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  EmailLoginModal: (props: any) => (
    <div data-testid="email-login-modal">
      {props.open && (
        <button data-testid="mock-email-success" onClick={() => props.onSuccess({ address: '0xEmailUser' })}>
          Complete Email Login
        </button>
      )}
    </div>
  )
}))

jest.mock('./ConfirmingLogin', () => ({
  ConfirmingLogin: () => <div data-testid="confirming-login" />
}))

jest.mock('decentraland-connect', () => ({
  connection: {
    disconnect: jest.fn().mockResolvedValue(undefined)
  }
}))

// Mock the styled components file directly to avoid complex decentraland-ui2 mocking
jest.mock('./LoginPage.styled', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return {
    Background: Div,
    BackgroundWrapper: Div,
    GuestInfo: Div,
    Left: Div,
    LeftInfo: Div,
    Main: Div,
    MainContainer: Div,
    NewUserInfo: Div
  }
})

jest.mock('decentraland-ui2', () => ({
  CircularProgress: () => null,
  Desktop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock Connection to expose onConnect
let capturedOnConnect: ((type: ConnectionOptionType) => void) | undefined
let capturedOnEmailSubmit: ((email: string) => void) | undefined
/* eslint-disable @typescript-eslint/naming-convention -- matches exported enum shape */
jest.mock('../../Connection', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Connection: (props: any) => {
    capturedOnConnect = props.onConnect
    capturedOnEmailSubmit = props.onEmailSubmit
    return <div data-testid="connection" />
  },
  ConnectionOptionType: {
    EMAIL: 'email',
    METAMASK: 'metamask',
    GOOGLE: 'google',
    DISCORD: 'discord',
    APPLE: 'apple',
    X: 'x',
    FORTMATIC: 'fortmatic',
    COINBASE: 'coinbase',
    WALLET_CONNECT: 'wallet_connect'
  }
}))
/* eslint-enable @typescript-eslint/naming-convention */

// --- Helpers ---

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

const createMockConnectionResponse = (): ConnectionResponse =>
  ({
    account: '0xWalletUser',
    provider: {},
    providerType: 'injected',
    chainId: 1
  }) as unknown as ConnectionResponse

describe('LoginPage', () => {
  afterEach(() => {
    jest.resetAllMocks()
    capturedOnConnect = undefined
    capturedOnEmailSubmit = undefined
    mockContextIdentity = undefined
  })

  describe('when a wallet login completes successfully', () => {
    let freshIdentity: AuthIdentity
    let connectionResponse: ConnectionResponse

    beforeEach(() => {
      freshIdentity = createMockIdentity()
      connectionResponse = createMockConnectionResponse()

      mockConnectToProvider.mockResolvedValue(connectionResponse)
      mockGetIdentitySignature.mockResolvedValue(freshIdentity)
      mockEnsureProfile.mockResolvedValue({ avatars: [{}] })
      mockCheckClockSync.mockResolvedValue(true)
      mockTrackLoginSuccess.mockResolvedValue(undefined)

      // Provide window.ethereum so injected provider check passes
      Object.defineProperty(window, 'ethereum', { value: {}, writable: true, configurable: true })
    })

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).ethereum
    })

    it('should pass the fresh identity from getIdentitySignature to ensureProfile', async () => {
      render(<LoginPage />)

      await waitFor(() => {
        expect(capturedOnConnect).toBeDefined()
      })

      capturedOnConnect!(ConnectionOptionType.METAMASK)

      await waitFor(() => {
        expect(mockEnsureProfile).toHaveBeenCalledWith(
          '0xWalletUser',
          freshIdentity,
          expect.objectContaining({ redirectTo: expect.any(String) })
        )
      })
    })

    it('should call getIdentitySignature with the connection data', async () => {
      render(<LoginPage />)

      await waitFor(() => {
        expect(capturedOnConnect).toBeDefined()
      })

      capturedOnConnect!(ConnectionOptionType.METAMASK)

      await waitFor(() => {
        expect(mockGetIdentitySignature).toHaveBeenCalledWith(connectionResponse)
      })
    })
  })

  describe('when an email login completes successfully', () => {
    let freshIdentity: AuthIdentity

    beforeEach(() => {
      freshIdentity = createMockIdentity()

      mockGetIdentitySignature.mockResolvedValue(freshIdentity)
      mockEnsureProfile.mockResolvedValue({ avatars: [{}] })
      mockCheckClockSync.mockResolvedValue(true)
      mockTrackLoginSuccess.mockResolvedValue(undefined)
    })

    it('should pass the fresh identity from getIdentitySignature to ensureProfile', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      await waitFor(() => {
        expect(capturedOnEmailSubmit).toBeDefined()
      })

      // Trigger email submit to open the email login modal
      capturedOnEmailSubmit!('test@example.com')

      // Wait for the modal to open and click the mock success button
      const successButton = await waitFor(() => {
        const btn = document.querySelector('[data-testid="mock-email-success"]')
        expect(btn).toBeTruthy()
        return btn as HTMLElement
      })

      await user.click(successButton)

      await waitFor(() => {
        expect(mockEnsureProfile).toHaveBeenCalledWith(
          '0xemailuser',
          freshIdentity,
          expect.objectContaining({ redirectTo: expect.any(String) })
        )
      })
    })

    it('should call getIdentitySignature without arguments', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      await waitFor(() => {
        expect(capturedOnEmailSubmit).toBeDefined()
      })

      capturedOnEmailSubmit!('test@example.com')

      const successButton = await waitFor(() => {
        const btn = document.querySelector('[data-testid="mock-email-success"]')
        expect(btn).toBeTruthy()
        return btn as HTMLElement
      })

      await user.click(successButton)

      await waitFor(() => {
        expect(mockGetIdentitySignature).toHaveBeenCalledWith()
      })
    })
  })

  describe('when the context already has an identity and a wallet login produces a new one', () => {
    let staleIdentity: AuthIdentity
    let freshIdentity: AuthIdentity
    let connectionResponse: ConnectionResponse

    beforeEach(() => {
      staleIdentity = {
        ...createMockIdentity(),
        expiration: new Date(Date.now() - 1000)
      } as unknown as AuthIdentity
      freshIdentity = createMockIdentity()
      connectionResponse = createMockConnectionResponse()

      mockContextIdentity = staleIdentity
      mockConnectToProvider.mockResolvedValue(connectionResponse)
      mockGetIdentitySignature.mockResolvedValue(freshIdentity)
      mockEnsureProfile.mockResolvedValue({ avatars: [{}] })
      mockCheckClockSync.mockResolvedValue(true)
      mockTrackLoginSuccess.mockResolvedValue(undefined)

      Object.defineProperty(window, 'ethereum', { value: {}, writable: true, configurable: true })
    })

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).ethereum
    })

    it('should pass the fresh identity to ensureProfile instead of the stale context identity', async () => {
      render(<LoginPage />)

      await waitFor(() => {
        expect(capturedOnConnect).toBeDefined()
      })

      capturedOnConnect!(ConnectionOptionType.METAMASK)

      await waitFor(() => {
        expect(mockEnsureProfile).toHaveBeenCalledWith(
          '0xWalletUser',
          freshIdentity,
          expect.objectContaining({ redirectTo: expect.any(String) })
        )
      })

      expect(mockEnsureProfile).not.toHaveBeenCalledWith(expect.anything(), staleIdentity, expect.anything())
    })
  })
})
