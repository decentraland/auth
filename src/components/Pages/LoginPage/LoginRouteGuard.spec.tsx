import { render } from '@testing-library/react'
import { LoginRouteGuard } from './LoginRouteGuard'

jest.mock('./SocialAutoLoginRedirect', () => ({
  SocialAutoLoginRedirect: ({ connectionType }: { connectionType: string }) => (
    <div data-testid="social-auto-login-redirect" data-connection-type={connectionType} />
  )
}))

jest.mock('./LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page" />
}))

jest.mock('decentraland-ui2', () => ({
  CircularProgress: () => <div data-testid="loading-spinner" />
}))

const mockSearchParams = (params: string) => {
  Object.defineProperty(window, 'location', {
    value: { search: params, pathname: '/login', href: `http://localhost/login${params}` },
    writable: true,
    configurable: true
  })
}

describe('LoginRouteGuard', () => {
  afterEach(() => {
    mockSearchParams('')
  })

  describe('when loginMethod is a social provider', () => {
    it('should render SocialAutoLoginRedirect for google', async () => {
      mockSearchParams('?loginMethod=google')
      const { getByTestId } = render(<LoginRouteGuard />)

      expect(getByTestId('social-auto-login-redirect')).toBeTruthy()
      expect(getByTestId('social-auto-login-redirect').getAttribute('data-connection-type')).toBe('google')
    })

    it('should render SocialAutoLoginRedirect for discord', async () => {
      mockSearchParams('?loginMethod=discord')
      const { getByTestId } = render(<LoginRouteGuard />)

      expect(getByTestId('social-auto-login-redirect').getAttribute('data-connection-type')).toBe('discord')
    })

    it('should render SocialAutoLoginRedirect for apple', async () => {
      mockSearchParams('?loginMethod=apple')
      const { getByTestId } = render(<LoginRouteGuard />)

      expect(getByTestId('social-auto-login-redirect').getAttribute('data-connection-type')).toBe('apple')
    })

    it('should render SocialAutoLoginRedirect for x', async () => {
      mockSearchParams('?loginMethod=x')
      const { getByTestId } = render(<LoginRouteGuard />)

      expect(getByTestId('social-auto-login-redirect').getAttribute('data-connection-type')).toBe('x')
    })

    it('should not render LoginPage', async () => {
      mockSearchParams('?loginMethod=google')
      const { queryByTestId } = render(<LoginRouteGuard />)

      expect(queryByTestId('login-page')).toBeNull()
    })
  })

  describe('when loginMethod is a non-social provider', () => {
    it('should render LoginPage for metamask', async () => {
      mockSearchParams('?loginMethod=metamask')
      const { findByTestId, queryByTestId } = render(<LoginRouteGuard />)

      expect(await findByTestId('login-page')).toBeTruthy()
      expect(queryByTestId('social-auto-login-redirect')).toBeNull()
    })

    it('should render LoginPage for email', async () => {
      mockSearchParams('?loginMethod=email')
      const { findByTestId } = render(<LoginRouteGuard />)

      expect(await findByTestId('login-page')).toBeTruthy()
    })
  })

  describe('when no loginMethod is provided', () => {
    it('should render LoginPage', async () => {
      mockSearchParams('')
      const { findByTestId } = render(<LoginRouteGuard />)

      expect(await findByTestId('login-page')).toBeTruthy()
    })
  })

  describe('when loginMethod is invalid', () => {
    it('should render LoginPage', async () => {
      mockSearchParams('?loginMethod=invalid')
      const { findByTestId } = render(<LoginRouteGuard />)

      expect(await findByTestId('login-page')).toBeTruthy()
    })
  })
})
