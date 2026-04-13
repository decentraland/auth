/* eslint-disable import/order */
import { render } from '@testing-library/react'

jest.mock('./AutoLoginRedirect', () => ({
  AutoLoginRedirect: ({ connectionType }: { connectionType: string }) => (
    <div data-testid="auto-login-redirect" data-connection-type={connectionType} />
  )
}))

jest.mock('./LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page" />
}))

jest.mock('decentraland-ui2', () => ({
  CircularProgress: () => <div data-testid="circular-progress" />
}))

import { LoginRouteGuard } from './LoginRouteGuard'

function mockSearchParams(params: string) {
  const url = `http://localhost/auth/login${params ? `?${params}` : ''}`
  Object.defineProperty(window, 'location', {
    writable: true,
    value: new URL(url)
  })
}

describe('LoginRouteGuard', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    })
  })

  describe('when loginMethod is a supported auto-login provider', () => {
    it('should render AutoLoginRedirect for google', () => {
      mockSearchParams('loginMethod=google')
      const { getByTestId } = render(<LoginRouteGuard />)
      expect(getByTestId('auto-login-redirect')).toBeInTheDocument()
      expect(getByTestId('auto-login-redirect')).toHaveAttribute('data-connection-type', 'google')
    })

    it('should render AutoLoginRedirect for discord', () => {
      mockSearchParams('loginMethod=discord')
      const { getByTestId } = render(<LoginRouteGuard />)
      expect(getByTestId('auto-login-redirect')).toBeInTheDocument()
      expect(getByTestId('auto-login-redirect')).toHaveAttribute('data-connection-type', 'discord')
    })

    it('should render AutoLoginRedirect for apple', () => {
      mockSearchParams('loginMethod=apple')
      const { getByTestId } = render(<LoginRouteGuard />)
      expect(getByTestId('auto-login-redirect')).toBeInTheDocument()
      expect(getByTestId('auto-login-redirect')).toHaveAttribute('data-connection-type', 'apple')
    })

    it('should render AutoLoginRedirect for x', () => {
      mockSearchParams('loginMethod=x')
      const { getByTestId } = render(<LoginRouteGuard />)
      expect(getByTestId('auto-login-redirect')).toBeInTheDocument()
      expect(getByTestId('auto-login-redirect')).toHaveAttribute('data-connection-type', 'x')
    })

    it('should render AutoLoginRedirect for metamask', () => {
      mockSearchParams('loginMethod=metamask')
      const { getByTestId } = render(<LoginRouteGuard />)
      expect(getByTestId('auto-login-redirect')).toBeInTheDocument()
      expect(getByTestId('auto-login-redirect')).toHaveAttribute('data-connection-type', 'metamask')
    })

    it('should not render LoginPage for auto-login providers', () => {
      mockSearchParams('loginMethod=google')
      const { queryByTestId } = render(<LoginRouteGuard />)
      expect(queryByTestId('login-page')).not.toBeInTheDocument()
    })
  })

  describe('when loginMethod is not a supported auto-login provider', () => {
    it('should render LoginPage for email', async () => {
      mockSearchParams('loginMethod=email')
      const { findByTestId } = render(<LoginRouteGuard />)
      expect(await findByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('when there is no loginMethod', () => {
    it('should render LoginPage', async () => {
      mockSearchParams('')
      const { findByTestId } = render(<LoginRouteGuard />)
      expect(await findByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('when loginMethod is invalid', () => {
    it('should render LoginPage', async () => {
      mockSearchParams('loginMethod=invalid')
      const { findByTestId } = render(<LoginRouteGuard />)
      expect(await findByTestId('login-page')).toBeInTheDocument()
    })
  })
})
