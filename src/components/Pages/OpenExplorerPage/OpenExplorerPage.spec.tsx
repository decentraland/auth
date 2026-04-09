/* eslint-disable @typescript-eslint/naming-convention -- mock shapes must match exported names */
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { OpenExplorerPage } from './OpenExplorerPage'

const mockLaunchDeepLink = jest.fn()
jest.mock('../RequestPage/utils', () => ({
  launchDeepLink: (...args: unknown[]) => mockLaunchDeepLink(...args)
}))

jest.mock('../../../modules/config', () => ({
  config: {
    get: (key: string) => {
      if (key === 'ENVIRONMENT') return 'production'
      return ''
    }
  }
}))

const mockNavigate = jest.fn()
jest.mock('../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

jest.mock('../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [
    {
      explorerText: 'Decentraland app'
    },
    'default'
  ]
}))

const mockPostIdentity = jest.fn()
jest.mock('../../../shared/auth', () => ({
  createAuthServerHttpClient: () => ({
    postIdentity: mockPostIdentity
  })
}))

let mockAccount: string | undefined = '0xTestAccount'
jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: () => ({
    get account() {
      return mockAccount
    }
  })
}))

jest.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: jest.fn()
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'mobile_auth.redirect_countdown') return `Opening ${params?.explorerText} in ${params?.countdown}...`
      if (key === 'mobile_auth.redirecting') return `Redirecting to ${params?.explorerText}...`
      if (key === 'mobile_auth.could_not_open') return `Could not open ${params?.explorerText}`
      if (key === 'mobile_auth.return_to') return `Open ${params?.explorerText}`
      if (key === 'connection_layout.validating_sign_in') return 'Verifying...'
      if (key === 'common.try_again') return 'Try again'
      return key
    }
  })
}))

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('./OpenExplorerPage.styled', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return { Container: Div, Wrapper: Div }
})

jest.mock('../../ConnectionModal/ConnectionLayout.styled', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return {
    ConnectionContainer: Div,
    ConnectionTitle: Div,
    DecentralandLogo: () => <div data-testid="dcl-logo" />,
    ErrorButtonContainer: Div,
    ProgressContainer: Div
  }
})

jest.mock('decentraland-ui2', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; children?: React.ReactNode }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  CircularProgress: () => <div data-testid="progress" />
}))

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

// --- Tests ---

describe('OpenExplorerPage', () => {
  const mockIdentity = createMockIdentity()

  beforeEach(() => {
    jest.useFakeTimers()
    mockAccount = '0xTestAccount'
    mockLaunchDeepLink.mockResolvedValue(true)
    ;(localStorageGetIdentity as jest.Mock).mockReturnValue(mockIdentity)
    mockPostIdentity.mockResolvedValue({ identityId: 'test-id-123' })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('when the account and identity are available', () => {
    it('should post the identity to the auth server', async () => {
      render(<OpenExplorerPage />)

      await waitFor(() => {
        expect(mockPostIdentity).toHaveBeenCalledWith(mockIdentity, { isMobile: false })
      })
    })

    it('should show a countdown after posting the identity', async () => {
      const { container } = render(<OpenExplorerPage />)

      await waitFor(() => {
        expect(container.textContent).toContain('Opening Decentraland app in 3...')
      })
    })

    it('should attempt deep link after countdown', async () => {
      const { container } = render(<OpenExplorerPage />)

      // Wait for postIdentity to resolve and countdown to appear
      await waitFor(() => {
        expect(container.textContent).toContain('Opening Decentraland app in')
      })

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(mockLaunchDeepLink).toHaveBeenCalledWith('decentraland://?dclenv=org&signin=test-id-123')
      })
    })
  })

  describe('when the deep link fails', () => {
    beforeEach(() => {
      mockLaunchDeepLink.mockResolvedValue(false)
    })

    it('should show a try again button', async () => {
      const { container, getByTestId } = render(<OpenExplorerPage />)

      await waitFor(() => {
        expect(container.textContent).toContain('Opening Decentraland app in')
      })

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(getByTestId('open-explorer-try-again-button')).toBeTruthy()
      })
    })
  })

  describe('when no account is available', () => {
    beforeEach(() => {
      mockAccount = undefined
    })

    it('should navigate to the login page', async () => {
      render(<OpenExplorerPage />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login'), { replace: true })
      })
    })
  })

  describe('when postIdentity fails', () => {
    beforeEach(() => {
      mockPostIdentity.mockRejectedValue(new Error('Server error'))
    })

    it('should show an error state with try again', async () => {
      const { getByTestId } = render(<OpenExplorerPage />)

      await waitFor(() => {
        expect(getByTestId('open-explorer-try-again-button')).toBeTruthy()
      })
    })
  })

  describe('when the open explorer button is clicked', () => {
    it('should attempt to launch the deep link', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const { container, getByTestId } = render(<OpenExplorerPage />)

      await waitFor(() => {
        expect(container.textContent).toContain('Opening Decentraland app in')
      })

      await user.click(getByTestId('open-explorer-button'))

      expect(mockLaunchDeepLink).toHaveBeenCalledWith('decentraland://?dclenv=org&signin=test-id-123')
    })
  })
})
