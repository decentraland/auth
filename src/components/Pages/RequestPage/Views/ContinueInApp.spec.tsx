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

const DEEP_LINK_URL = 'decentraland://open?signin=anIdentityId'

describe('ContinueInApp', () => {
  let originalLocation: Location
  let mockOnContinue: jest.Mock

  const renderContinueInApp = (requestId: string, initialEntry: string, autoStart = true) => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ContinueInApp onContinue={mockOnContinue} requestId={requestId} deepLinkUrl={DEEP_LINK_URL} autoStart={autoStart} />
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    mockOnContinue = jest.fn()
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

  describe('when the request id is a regular request id', () => {
    describe('and the view has just mounted', () => {
      beforeEach(() => {
        renderContinueInApp('aRequestId', '/auth/requests/aRequestId?targetConfigId=default&flow=deeplink')
      })

      it('should not attempt the deep link before the countdown finishes', () => {
        expect(mockedLaunchDeepLink).not.toHaveBeenCalled()
      })
    })

    describe('and the deep link fails to launch', () => {
      beforeEach(async () => {
        mockedLaunchDeepLink.mockResolvedValueOnce(false)
        renderContinueInApp('aRequestId', '/auth/requests/aRequestId?targetConfigId=default&flow=deeplink', false)
        await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
        await waitFor(() => {
          expect(screen.getByTestId('continue-in-app-go-back-button')).toBeInTheDocument()
        })
      })

      it('should redirect back to the request page without the flow param when going back to login', async () => {
        await userEvent.click(screen.getByTestId('continue-in-app-go-back-button'))
        expect(window.location.href).toBe('/auth/requests/aRequestId?targetConfigId=default')
      })
    })
  })

  describe('when the request id is the client-login pseudo request id', () => {
    describe('and the deep link launches successfully', () => {
      beforeEach(() => {
        mockedLaunchDeepLink.mockResolvedValueOnce(true)
        renderContinueInApp('client-login', '/auth/requests/client-login?targetConfigId=default')
      })

      it('should attempt the deep link immediately without a countdown', async () => {
        await waitFor(() => {
          expect(mockedLaunchDeepLink).toHaveBeenCalledWith(DEEP_LINK_URL)
        })
      })

      it('should notify the continue callback', async () => {
        await waitFor(() => {
          expect(mockOnContinue).toHaveBeenCalled()
        })
      })
    })

    describe('and the deep link fails to launch', () => {
      beforeEach(async () => {
        mockedLaunchDeepLink.mockResolvedValueOnce(false)
        renderContinueInApp('client-login', '/auth/requests/client-login?targetConfigId=default')
        await waitFor(() => {
          expect(screen.getByTestId('continue-in-app-try-again-button')).toBeInTheDocument()
        })
      })

      it('should offer a retry instead of going back to login', () => {
        expect(screen.queryByTestId('continue-in-app-go-back-button')).not.toBeInTheDocument()
      })

      it('should re-attempt the deep link without navigating anywhere when trying again', async () => {
        mockedLaunchDeepLink.mockResolvedValueOnce(true)
        await userEvent.click(screen.getByTestId('continue-in-app-try-again-button'))
        await waitFor(() => {
          expect(mockedLaunchDeepLink).toHaveBeenCalledTimes(2)
        })
        expect(window.location.href).toBe('')
      })
    })
  })
})
