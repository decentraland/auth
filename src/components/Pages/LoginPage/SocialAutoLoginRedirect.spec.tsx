/* eslint-disable @typescript-eslint/naming-convention -- mock shapes must match exported names */
import { render, waitFor } from '@testing-library/react'
import { ConnectionOptionType } from '../../Connection/Connection.types'
import { SocialAutoLoginRedirect } from './SocialAutoLoginRedirect'

const mockConnectToSocialProvider = jest.fn()
jest.mock('./utils', () => ({
  connectToSocialProvider: (...args: unknown[]) => mockConnectToSocialProvider(...args)
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('../../../shared/locations', () => ({
  locations: {
    login: () => '/auth/login'
  }
}))

const mockTrackLoginClick = jest.fn()
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackLoginClick: mockTrackLoginClick
  })
}))

jest.mock('../../../hooks/redirection', () => ({
  useAfterLoginRedirection: () => ({ url: 'https://decentraland.org/play', redirect: jest.fn() })
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'social_auto_login.redirecting_to') return `Redirecting to ${params?.provider}...`
      return key
    }
  })
}))

jest.mock('../../FeatureFlagsProvider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createContext } = require('react')
  return {
    FeatureFlagsContext: {
      ...createContext({
        flags: { 'dapps-magic-dev-test': false },
        variants: {},
        initialized: true
      })
    },
    FeatureFlagsKeys: { MAGIC_TEST: 'dapps-magic-dev-test' }
  }
})

jest.mock('../../Pages/CallbackPage/CallbackPage.styled', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return { Container: Div, Wrapper: Div }
})

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('../../ConnectionModal/ConnectionLayout.styled', () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  )
  return {
    ConnectionContainer: Div,
    ConnectionTitle: Div,
    DecentralandLogo: () => <div data-testid="dcl-logo" />,
    ProgressContainer: Div
  }
})

jest.mock('decentraland-ui2', () => ({
  CircularProgress: () => <div data-testid="loading-spinner" />
}))

describe('SocialAutoLoginRedirect', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when rendered with a social connection type', () => {
    it('should render the animated background', () => {
      const { getByTestId } = render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.GOOGLE} />)
      expect(getByTestId('animated-background')).toBeTruthy()
    })

    it('should show a redirecting message with the provider name', () => {
      const { container } = render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.GOOGLE} />)
      expect(container.textContent).toContain('Redirecting to Google...')
    })

    it('should render a loading spinner', () => {
      const { getByTestId } = render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.GOOGLE} />)
      expect(getByTestId('loading-spinner')).toBeTruthy()
    })

    it('should track the login click', async () => {
      render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.GOOGLE} />)

      await waitFor(() => {
        expect(mockTrackLoginClick).toHaveBeenCalledWith({
          method: ConnectionOptionType.GOOGLE,
          type: 'web2'
        })
      })
    })

    it('should call connectToSocialProvider with the correct arguments', async () => {
      render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.GOOGLE} />)

      await waitFor(() => {
        expect(mockConnectToSocialProvider).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE, false, 'https://decentraland.org/play')
      })
    })

    it('should not call connectToSocialProvider twice', async () => {
      render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.DISCORD} />)

      await waitFor(() => {
        expect(mockConnectToSocialProvider).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('when connectToSocialProvider throws an error', () => {
    const originalHref = window.location.href

    beforeEach(() => {
      mockConnectToSocialProvider.mockRejectedValue(new Error('Magic SDK failed'))
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: originalHref },
        writable: true,
        configurable: true
      })
    })

    it('should navigate to the login page without loginMethod', async () => {
      render(<SocialAutoLoginRedirect connectionType={ConnectionOptionType.GOOGLE} />)

      await waitFor(() => {
        expect(window.location.href).toContain('/login')
        expect(window.location.href).not.toContain('loginMethod')
      })
    })
  })
})
