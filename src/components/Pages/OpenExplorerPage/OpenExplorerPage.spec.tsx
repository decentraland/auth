/* eslint-disable @typescript-eslint/naming-convention -- mock shapes must match exported names */
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'mobile_auth.redirect_countdown') return `Opening ${params?.explorerText} in ${params?.countdown}...`
      if (key === 'mobile_auth.redirecting') return `Redirecting to ${params?.explorerText}...`
      if (key === 'mobile_auth.could_not_open') return `Could not open ${params?.explorerText}`
      if (key === 'mobile_auth.return_to') return `Open ${params?.explorerText}`
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
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; children?: React.ReactNode }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  CircularProgress: () => <div data-testid="progress" />
}))

// Mock useSearchParams to control the identityId param
let mockSearchParams = new URLSearchParams('identityId=test-id-123')
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [mockSearchParams]
}))

describe('OpenExplorerPage', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockLaunchDeepLink.mockResolvedValue(true)
    mockSearchParams = new URLSearchParams('identityId=test-id-123')
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('when rendered with an identityId search param', () => {
    it('should show a countdown message', () => {
      const { container } = render(<OpenExplorerPage />)
      expect(container.textContent).toContain('Opening Decentraland app in 3...')
    })

    it('should show a button to open the explorer', () => {
      const { getByTestId } = render(<OpenExplorerPage />)
      expect(getByTestId('open-explorer-button')).toBeTruthy()
    })

    it('should attempt deep link after countdown', async () => {
      render(<OpenExplorerPage />)

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(mockLaunchDeepLink).toHaveBeenCalledWith('decentraland://?dclenv=org&signin=test-id-123')
      })
    })
  })

  describe('when deep link fails', () => {
    beforeEach(() => {
      mockLaunchDeepLink.mockResolvedValue(false)
    })

    it('should show a try again button', async () => {
      const { getByTestId } = render(<OpenExplorerPage />)

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(getByTestId('open-explorer-try-again-button')).toBeTruthy()
      })
    })

    it('should navigate to login when try again is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const { getByTestId } = render(<OpenExplorerPage />)

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(getByTestId('open-explorer-try-again-button')).toBeTruthy()
      })

      await user.click(getByTestId('open-explorer-try-again-button'))

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login'), { replace: true })
    })
  })

  describe('when no identityId is provided', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams('')
    })

    it('should navigate to the login page', () => {
      render(<OpenExplorerPage />)

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login'), { replace: true })
    })
  })

  describe('when the open explorer button is clicked', () => {
    it('should attempt to launch the deep link', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      const { getByTestId } = render(<OpenExplorerPage />)

      await user.click(getByTestId('open-explorer-button'))

      expect(mockLaunchDeepLink).toHaveBeenCalledWith('decentraland://?dclenv=org&signin=test-id-123')
    })
  })
})
