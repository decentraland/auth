/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { launchDeepLink } from '../utils'
import { ContinueInApp } from './ContinueInApp'

jest.mock('../utils', () => ({
  launchDeepLink: jest.fn()
}))

jest.mock('../../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [{ explorerText: 'Explorer' }]
}))

jest.mock('../Container', () => ({
  Container: (props: { children: ReactNode }) => <div>{props.children}</div>
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('decentraland-ui2', () => ({
  muiIcons: {
    ArrowBack: () => null,
    Login: () => null
  },
  Button: (props: any) => <button {...props} />,
  styled: (component: any) => () => component
}))

const mockedLaunchDeepLink = launchDeepLink as jest.MockedFunction<typeof launchDeepLink>

const renderContinueInApp = (requestId: string, initialEntry: string) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ContinueInApp onContinue={jest.fn()} requestId={requestId} deepLinkUrl="decentraland://open?signin=anIdentityId" autoStart={false} />
    </MemoryRouter>
  )
}

describe('ContinueInApp', () => {
  let originalLocation: Location

  beforeEach(() => {
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' }
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    })
    jest.resetAllMocks()
  })

  describe('when the deep link fails to launch and the user goes back to login', () => {
    beforeEach(() => {
      mockedLaunchDeepLink.mockResolvedValueOnce(false)
    })

    describe('and the request id is a regular request id', () => {
      beforeEach(async () => {
        renderContinueInApp('aRequestId', '/auth/requests/aRequestId?targetConfigId=default&flow=deeplink')
        await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
        await waitFor(() => {
          expect(screen.getByTestId('continue-in-app-go-back-button')).toBeInTheDocument()
        })
      })

      it('should redirect back to the request page without the flow param', async () => {
        await userEvent.click(screen.getByTestId('continue-in-app-go-back-button'))
        expect(window.location.href).toBe('/auth/requests/aRequestId?targetConfigId=default')
      })
    })

    describe('and the request id is the login pseudo request id', () => {
      beforeEach(async () => {
        renderContinueInApp('login', '/auth/requests/login?targetConfigId=default&flow=deeplink')
        await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
        await waitFor(() => {
          expect(screen.getByTestId('continue-in-app-go-back-button')).toBeInTheDocument()
        })
      })

      it('should redirect to the login page with the login request page as the redirect target', async () => {
        await userEvent.click(screen.getByTestId('continue-in-app-go-back-button'))
        expect(window.location.href).toBe(`/auth/login?redirectTo=${encodeURIComponent('/auth/requests/login?targetConfigId=default')}`)
      })
    })
  })
})
