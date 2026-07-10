/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  Container: (props: { children: ReactNode; canChangeAccount?: boolean }) => (
    <div>
      {props.canChangeAccount ? <div data-testid="change-account-link" /> : null}
      {props.children}
    </div>
  )
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
// Matches COUNTDOWN_SECONDS (5) in the component: the interval decrements once per second.
const COUNTDOWN_MS = 5000

describe('ContinueInApp', () => {
  let originalLocation: Location
  let mockOnContinue: jest.Mock

  const renderContinueInApp = (options: { isClientLogin?: boolean; autoStart?: boolean } = {}) => {
    const { isClientLogin = false, autoStart = true } = options
    return render(
      <MemoryRouter initialEntries={['/auth/requests/aRequestId?targetConfigId=default&flow=deeplink']}>
        <ContinueInApp
          onContinue={mockOnContinue}
          requestId="aRequestId"
          deepLinkUrl={DEEP_LINK_URL}
          autoStart={autoStart}
          isClientLogin={isClientLogin}
        />
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

  describe('when the view has just mounted', () => {
    beforeEach(() => {
      renderContinueInApp()
    })

    it('should not attempt the deep link before the countdown finishes', () => {
      expect(mockedLaunchDeepLink).not.toHaveBeenCalled()
    })
  })

  describe('when the countdown runs to completion', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      mockedLaunchDeepLink.mockResolvedValue(true)
      renderContinueInApp({ isClientLogin: true })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should launch the deep link automatically when it reaches zero', async () => {
      await act(async () => {
        jest.advanceTimersByTime(COUNTDOWN_MS)
      })
      expect(mockedLaunchDeepLink).toHaveBeenCalledWith(DEEP_LINK_URL)
    })

    it('should launch the deep link only once', async () => {
      await act(async () => {
        jest.advanceTimersByTime(COUNTDOWN_MS * 2)
      })
      expect(mockedLaunchDeepLink).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the return button is pressed while the countdown is finishing', () => {
    let resolveLaunch: (value: boolean) => void

    beforeEach(() => {
      jest.useFakeTimers()
      // Keep the launch in flight so the countdown's zero-tick fires before it resolves.
      mockedLaunchDeepLink.mockReturnValue(
        new Promise<boolean>(resolve => {
          resolveLaunch = resolve
        })
      )
      renderContinueInApp({ isClientLogin: true })
      fireEvent.click(screen.getByTestId('continue-in-app-return-button'))
      act(() => {
        jest.advanceTimersByTime(COUNTDOWN_MS)
      })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should open the client only once', async () => {
      await act(async () => {
        resolveLaunch(true)
      })
      expect(mockedLaunchDeepLink).toHaveBeenCalledTimes(1)
    })

    it('should notify the continue callback only once', async () => {
      await act(async () => {
        resolveLaunch(true)
      })
      expect(mockOnContinue).toHaveBeenCalledTimes(1)
    })
  })

  describe('when opening the client from the return button', () => {
    describe('and the deep link launches successfully', () => {
      beforeEach(async () => {
        mockedLaunchDeepLink.mockResolvedValueOnce(true)
        renderContinueInApp({ autoStart: false })
        await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
        await waitFor(() => {
          expect(mockOnContinue).toHaveBeenCalled()
        })
      })

      it('should attempt to launch the deep link', () => {
        expect(mockedLaunchDeepLink).toHaveBeenCalledWith(DEEP_LINK_URL)
      })

      it('should notify the continue callback', () => {
        expect(mockOnContinue).toHaveBeenCalled()
      })
    })
  })

  describe('when it is a regular deep-link flow', () => {
    describe('and the view has just mounted', () => {
      beforeEach(() => {
        renderContinueInApp({ isClientLogin: false })
      })

      it('should not offer the change-account link', () => {
        expect(screen.queryByTestId('change-account-link')).not.toBeInTheDocument()
      })
    })

    describe('and the deep link fails to launch', () => {
      beforeEach(async () => {
        mockedLaunchDeepLink.mockResolvedValueOnce(false)
        renderContinueInApp({ isClientLogin: false, autoStart: false })
        await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
        await waitFor(() => {
          expect(screen.getByTestId('continue-in-app-go-back-button')).toBeInTheDocument()
        })
      })

      describe('and going back to login', () => {
        it('should redirect back to the request page without the flow param', async () => {
          await userEvent.click(screen.getByTestId('continue-in-app-go-back-button'))
          expect(window.location.href).toBe('/auth/requests/aRequestId?targetConfigId=default')
        })
      })
    })
  })

  describe('when it is the client-login flow', () => {
    describe('and the view has just mounted', () => {
      beforeEach(() => {
        renderContinueInApp({ isClientLogin: true })
      })

      it('should offer the change-account link so the user can switch wallets', () => {
        expect(screen.getByTestId('change-account-link')).toBeInTheDocument()
      })
    })

    describe('and the deep link fails to launch', () => {
      beforeEach(async () => {
        mockedLaunchDeepLink.mockResolvedValueOnce(false)
        renderContinueInApp({ isClientLogin: true, autoStart: false })
        await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
        await waitFor(() => {
          expect(screen.getByTestId('continue-in-app-try-again-button')).toBeInTheDocument()
        })
      })

      it('should offer a retry instead of going back to login', () => {
        expect(screen.queryByTestId('continue-in-app-go-back-button')).not.toBeInTheDocument()
      })

      it('should still offer the change-account link so the user can switch wallets', () => {
        expect(screen.getByTestId('change-account-link')).toBeInTheDocument()
      })

      describe('and trying again', () => {
        beforeEach(async () => {
          await userEvent.click(screen.getByTestId('continue-in-app-try-again-button'))
        })

        it('should return to the redirecting view', () => {
          expect(screen.getByTestId('continue-in-app-return-button')).toBeInTheDocument()
        })

        it('should re-attempt the deep link when the client is reopened', async () => {
          mockedLaunchDeepLink.mockResolvedValueOnce(true)
          await userEvent.click(screen.getByTestId('continue-in-app-return-button'))
          await waitFor(() => {
            expect(mockedLaunchDeepLink).toHaveBeenCalledTimes(2)
          })
        })
      })
    })
  })
})
