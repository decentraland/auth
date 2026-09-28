/* eslint-disable @typescript-eslint/naming-convention */
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileAuthPage } from './MobileAuthPage'

const mockCreateMagicInstance = jest.fn()
const mockDisconnectWallet = jest.fn()
const mockGetIdentitySignature = jest.fn()
const mockConnectToProvider = jest.fn()
const mockPostIdentity = jest.fn()
const mockTrackLoginSuccess = jest.fn()
const mockTrackLoginClick = jest.fn()

jest.mock('@dcl/hooks', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('decentraland-connect', () => ({ connection: { disconnect: jest.fn() } }))
jest.mock('../../../hooks/targetConfig', () => ({ useTargetConfig: () => [{ connectionOptions: {}, explorerText: 'App' }] }))
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackLoginSuccess: mockTrackLoginSuccess, trackLoginClick: mockTrackLoginClick })
}))
jest.mock('../../../shared/auth', () => ({ createAuthServerHttpClient: () => ({ postIdentity: mockPostIdentity }) }))
jest.mock('../../../shared/connection/identity', () => ({
  ONE_MONTH_IN_MINUTES: 43200,
  getIdentitySignature: (...args: unknown[]) => mockGetIdentitySignature(...args)
}))
jest.mock('../../../shared/thirdweb', () => ({ disconnectWallet: () => mockDisconnectWallet(), sendEmailOTP: jest.fn() }))
jest.mock('../../../shared/utils/magicSdk', () => ({ createMagicInstance: () => mockCreateMagicInstance() }))
jest.mock('../../../shared/utils/errorHandler', () => ({ handleError: jest.fn() }))
jest.mock('../../FeatureFlagsProvider', () => ({
  FeatureFlagsContext: jest.requireActual('react').createContext({ initialized: true, flags: {} }),
  FeatureFlagsKeys: { MAGIC_TEST: 'magic_test' }
}))
jest.mock('../../Connection', () => ({ ConnectionOptionType: { EMAIL: 'email', METAMASK: 'metamask' } }))
jest.mock('../../ConnectionModal/ConnectionLayout', () => ({ ConnectionLayout: () => <div>Connecting</div> }))
jest.mock('../LoginPage/utils', () => ({
  connectToProvider: () => mockConnectToProvider(),
  fromConnectionOptionToProviderType: () => 'injected',
  isEmailLogin: () => false,
  isSocialLogin: () => false
}))
jest.mock('./MobileAuthSuccess', () => ({ MobileAuthSuccess: () => <div>Login complete</div> }))
jest.mock('./MobileEmailLoginModal', () => ({ MobileEmailLoginModal: () => null }))
jest.mock('./MobileProviderSelection', () => ({
  MobileProviderSelection: ({ onConnect }: { onConnect: (type: string) => void }) => (
    <button onClick={() => onConnect('metamask')}>Connect wallet</button>
  )
}))
jest.mock('./MobileAuthPage.styled', () => ({ Main: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('./testAuth', () => ({ isTestAuthEmail: () => false }))

describe('when mobile session cleanup is pending', () => {
  let resolveMagic: (value: { user: { isLoggedIn: () => Promise<boolean> } }) => void
  let view: ReturnType<typeof render>

  beforeEach(() => {
    mockCreateMagicInstance.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMagic = resolve
      })
    )
    mockConnectToProvider.mockResolvedValueOnce({ account: '0x1111111111111111111111111111111111111111', provider: {} })
    mockGetIdentitySignature.mockImplementationOnce(async () => {
      localStorage.setItem('single-sign-on-new-login', 'new identity')
      return { authChain: [] }
    })
    mockPostIdentity.mockResolvedValueOnce({ identityId: 'new-login' })
  })

  afterEach(() => {
    localStorage.clear()
    jest.resetAllMocks()
  })

  describe('and the user visits the provider chooser', () => {
    beforeEach(() => {
      view = render(
        <MemoryRouter>
          <MobileAuthPage />
        </MemoryRouter>
      )
    })

    it('should withhold manual login until cleanup finishes', async () => {
      expect(screen.queryByRole('button', { name: 'Connect wallet' })).not.toBeInTheDocument()
      await act(async () => {
        resolveMagic({ user: { isLoggedIn: async () => false } })
      })
      expect(await screen.findByRole('button', { name: 'Connect wallet' })).toBeEnabled()
    })

    it('should preserve the new identity after the user signs in', async () => {
      await act(async () => {
        resolveMagic({ user: { isLoggedIn: async () => false } })
      })
      await userEvent.click(await screen.findByRole('button', { name: 'Connect wallet' }))
      await screen.findByText('Login complete')
      expect(localStorage.getItem('single-sign-on-new-login')).toBe('new identity')
      expect(mockDisconnectWallet).toHaveBeenCalledTimes(1)
    })

    it('should stop cleanup after the page unmounts', async () => {
      view.unmount()
      await act(async () => {
        resolveMagic({ user: { isLoggedIn: async () => false } })
      })
      expect(mockDisconnectWallet).not.toHaveBeenCalled()
    })
  })

  describe('and a provider was selected by the URL', () => {
    beforeEach(() => {
      view = render(
        <MemoryRouter initialEntries={['/?provider=metamask']}>
          <MobileAuthPage />
        </MemoryRouter>
      )
    })

    it('should connect only after cleanup completes', async () => {
      expect(mockConnectToProvider).not.toHaveBeenCalled()
      await act(async () => {
        resolveMagic({ user: { isLoggedIn: async () => false } })
      })
      await screen.findByText('Login complete')
      expect(mockDisconnectWallet.mock.invocationCallOrder[0]).toBeLessThan(mockConnectToProvider.mock.invocationCallOrder[0])
    })

    it('should not automatically connect after the page unmounts', async () => {
      view.unmount()
      await act(async () => {
        resolveMagic({ user: { isLoggedIn: async () => false } })
      })
      expect(mockConnectToProvider).not.toHaveBeenCalled()
    })
  })

  describe('and the page mounts in StrictMode', () => {
    beforeEach(() => {
      render(
        <StrictMode>
          <MemoryRouter initialEntries={['/?provider=metamask']}>
            <MobileAuthPage />
          </MemoryRouter>
        </StrictMode>
      )
    })

    it('should finish initialization and sign in once', async () => {
      await act(async () => {
        resolveMagic({ user: { isLoggedIn: async () => false } })
      })
      await screen.findByText('Login complete')
      expect(mockCreateMagicInstance).toHaveBeenCalledTimes(1)
      expect(mockConnectToProvider).toHaveBeenCalledTimes(1)
    })
  })
})
