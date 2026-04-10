/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/order */
import { render, waitFor } from '@testing-library/react'
import { ConnectionOptionType } from '../../Connection/Connection.types'

const mockConnectToSocialProvider = jest.fn()
jest.mock('./utils', () => ({
  connectToSocialProvider: (...args: unknown[]) => mockConnectToSocialProvider(...args)
}))

jest.mock('../../FeatureFlagsProvider', () => {
  const { createContext: createCtx } = require('react')
  return {
    FeatureFlagsContext: createCtx({
      flags: {} as Record<string, boolean | undefined>,
      variants: {},
      initialized: true
    }),
    FeatureFlagsKeys: {
      MAGIC_TEST: 'dapps-magic-dev-test'
    }
  }
})

jest.mock('../../Pages/CallbackPage/CallbackPage.styled', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div data-testid="container">{children}</div>,
  Wrapper: ({ children }: { children: React.ReactNode }) => <div data-testid="wrapper">{children}</div>
}))

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('../../ConnectionModal/ConnectionLayout.styled', () => ({
  ConnectionContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="connection-container">{children}</div>,
  ConnectionTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="connection-title">{children}</div>,
  DecentralandLogo: () => <div data-testid="decentraland-logo" />,
  ProgressContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="progress-container">{children}</div>
}))

jest.mock('decentraland-ui2', () => ({
  CircularProgress: () => <div data-testid="circular-progress" />
}))

const mockTrackLoginClick = jest.fn()
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackLoginClick: mockTrackLoginClick
  })
}))

jest.mock('../../../hooks/redirection', () => ({
  useAfterLoginRedirection: () => ({ url: 'https://decentraland.org/' })
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'social_auto_login.redirecting_to' && params?.provider) {
        return `Redirecting to ${params.provider}...`
      }
      return key
    }
  })
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { SocialAutoLoginRedirect } from './SocialAutoLoginRedirect'

type RenderOptions = {
  connectionType: ConnectionOptionType
  initialized?: boolean
}

function renderComponent({ connectionType, initialized = true }: RenderOptions) {
  return render(
    <FeatureFlagsContext.Provider
      value={{
        flags: { 'dapps-magic-dev-test': false },
        variants: {},
        initialized
      }}
    >
      <SocialAutoLoginRedirect connectionType={connectionType} />
    </FeatureFlagsContext.Provider>
  )
}

describe('SocialAutoLoginRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConnectToSocialProvider.mockResolvedValue(undefined)
  })

  describe('when rendering', () => {
    it('should render the animated background', () => {
      const { getByTestId } = renderComponent({ connectionType: ConnectionOptionType.GOOGLE })
      expect(getByTestId('animated-background')).toBeInTheDocument()
    })

    it('should show the redirecting to Google message', () => {
      const { getByTestId } = renderComponent({ connectionType: ConnectionOptionType.GOOGLE })
      expect(getByTestId('connection-title')).toHaveTextContent('Redirecting to Google...')
    })

    it('should render a loading spinner', () => {
      const { getByTestId } = renderComponent({ connectionType: ConnectionOptionType.GOOGLE })
      expect(getByTestId('circular-progress')).toBeInTheDocument()
    })
  })

  describe('when feature flags are initialized', () => {
    it('should track a login click with analytics', async () => {
      renderComponent({ connectionType: ConnectionOptionType.GOOGLE })
      await waitFor(() => {
        expect(mockTrackLoginClick).toHaveBeenCalledWith({
          method: ConnectionOptionType.GOOGLE,
          type: 'web2'
        })
      })
    })

    it('should call connectToSocialProvider with the correct arguments', async () => {
      renderComponent({ connectionType: ConnectionOptionType.GOOGLE })
      await waitFor(() => {
        expect(mockConnectToSocialProvider).toHaveBeenCalledWith(ConnectionOptionType.GOOGLE, false, 'https://decentraland.org/')
      })
    })
  })

  describe('when feature flags are not initialized', () => {
    it('should not call connectToSocialProvider', () => {
      renderComponent({ connectionType: ConnectionOptionType.GOOGLE, initialized: false })
      expect(mockConnectToSocialProvider).not.toHaveBeenCalled()
    })
  })

  describe('when the redirect fails', () => {
    it('should navigate to the login page', async () => {
      mockConnectToSocialProvider.mockRejectedValue(new Error('OAuth error'))

      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' }
      })

      renderComponent({ connectionType: ConnectionOptionType.GOOGLE })

      await waitFor(() => {
        expect(window.location.href).toBe('/login')
      })

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation
      })
    })
  })
})
