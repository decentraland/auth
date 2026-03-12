import { MemoryRouter } from 'react-router-dom'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { TranslationProvider } from '@dcl/hooks'
import { ProviderType } from '@dcl/schemas'
import { DclThemeProvider, WearablePreview, darkTheme } from 'decentraland-ui2'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useSignRequest } from '../../../hooks/useSignRequest'
import { useTrackReferral } from '../../../hooks/useTrackReferral'
import { fetchProfile } from '../../../modules/profile'
import { translations } from '../../../modules/translations'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isEmailValid } from '../../../shared/email'
import { getStoredEmail } from '../../../shared/onboarding/getStoredEmail'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { checkWebGpuSupport } from '../../../shared/utils/webgpu'
import { createMockIdentity } from '../../../tests/mocks/profile'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { AvatarSetupPage } from './AvatarSetupPage'

// Mock all external dependencies
jest.mock('../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: jest.fn()
}))

jest.mock('../../../hooks/redirection', () => ({
  useAfterLoginRedirection: jest.fn()
}))

jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: jest.fn()
}))

jest.mock('../../../hooks/useSignRequest', () => ({
  useSignRequest: jest.fn()
}))

jest.mock('../../../hooks/useTrackReferral', () => ({
  useTrackReferral: jest.fn()
}))

jest.mock('../../../modules/config', () => ({
  config: { get: jest.fn().mockReturnValue('https://mock-url.com') }
}))

jest.mock('../../../modules/profile', () => ({
  fetchProfile: jest.fn()
}))

jest.mock('../../../shared/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  IpValidationError: class IpValidationError extends Error {
    requestId: string
    reason: string
    constructor(requestId: string, reason: string) {
      super(reason)
      this.name = 'IpValidationError'
      this.requestId = requestId
      this.reason = reason
    }
  },
  createAuthServerHttpClient: jest.fn().mockReturnValue({}),
  createAuthServerWsClient: jest.fn().mockReturnValue({})
}))

jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: jest.fn()
}))

jest.mock('../../../shared/email', () => ({
  isEmailValid: jest.fn()
}))

jest.mock('../../../shared/locations', () => ({
  locations: {
    login: jest.fn().mockReturnValue('/login'),
    setup: jest.fn().mockReturnValue('/setup'),
    avatarSetup: jest.fn().mockReturnValue('/avatar-setup')
  }
}))

jest.mock('../../../shared/onboarding/getStoredEmail', () => ({
  getStoredEmail: jest.fn()
}))

jest.mock('../../../shared/onboarding/trackCheckpoint', () => ({
  trackCheckpoint: jest.fn()
}))

jest.mock('../../../shared/profile', () => ({
  isProfileComplete: jest.fn()
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn().mockImplementation((_error: unknown, _context: string) => {
    if (_error instanceof Error) return _error.message
    return 'Unknown error'
  })
}))

jest.mock('../../../shared/utils/webgpu', () => ({
  checkWebGpuSupport: jest.fn()
}))

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('../../CharacterCounter', () => ({
  CharacterCounterComponent: ({
    characterCount,
    maxCharacters,
    hasError
  }: {
    characterCount: number
    maxCharacters: number
    hasError: boolean
  }) => (
    <div data-testid="character-counter">
      {characterCount}/{maxCharacters}
      {hasError && <span>limit reached</span>}
    </div>
  )
}))

jest.mock('../SetupPage/utils', () => ({
  subscribeToNewsletter: jest.fn()
}))

jest.mock('./utils', () => ({
  deployProfileFromAvatarShape: jest.fn()
}))

// Mock lottie-react to avoid animation issues in tests
jest.mock('lottie-react', () => {
  return jest.fn(({ show, ...props }: { show?: boolean; [key: string]: unknown }) => (
    <div data-testid="lottie" data-show={show} {...props} />
  ))
})

jest.mock('decentraland-ui2', () => {
  const actual = jest.requireActual('decentraland-ui2')
  return {
    ...actual,
    WearablePreview: Object.assign(
      (props: { id: string; onLoad?: () => void; [key: string]: unknown }) => (
        <div data-testid="wearable-preview" data-id={props.id}>
          <button data-testid="trigger-onload" onClick={() => props.onLoad?.()} />
        </div>
      ),
      {
        createController: jest.fn()
      }
    ),
    launchDesktopApp: jest.fn(),
    CircularProgress: ({ ...props }: Record<string, unknown>) => <div data-testid="circular-progress" {...props} />,
    Logo: () => <div data-testid="logo" />
  }
})

const mockNavigate = jest.fn()
const mockRedirect = jest.fn()
const mockTrackAvatarEditSuccess = jest.fn()
const mockTrackTermsOfServiceSuccess = jest.fn()
const mockTrackCheckTermsOfService = jest.fn()
const mockSignRequest = jest.fn()
const mockTrackReferral = jest.fn()

const MOCK_ACCOUNT = '0x1234567890abcdef'
const MOCK_IDENTITY = createMockIdentity(MOCK_ACCOUNT)
const MOCK_PROVIDER = {} as ReturnType<typeof useCurrentConnectionData>['provider']

function setupDefaultMocks() {
  ;(useNavigateWithSearchParams as jest.Mock).mockReturnValue(mockNavigate)
  ;(useAfterLoginRedirection as jest.Mock).mockReturnValue({
    url: 'https://play.decentraland.org',
    redirect: mockRedirect
  })
  ;(useAnalytics as jest.Mock).mockReturnValue({
    trackAvatarEditSuccess: mockTrackAvatarEditSuccess,
    trackTermsOfServiceSuccess: mockTrackTermsOfServiceSuccess,
    trackCheckTermsOfService: mockTrackCheckTermsOfService
  })
  ;(useSignRequest as jest.Mock).mockReturnValue({
    signRequest: mockSignRequest,
    authServerClient: { current: null }
  })
  ;(useTrackReferral as jest.Mock).mockReturnValue({
    track: mockTrackReferral,
    isReady: true
  })
  ;(useCurrentConnectionData as jest.Mock).mockReturnValue({
    isLoading: false,
    account: MOCK_ACCOUNT,
    identity: MOCK_IDENTITY,
    provider: MOCK_PROVIDER,
    providerType: ProviderType.MAGIC,
    chainId: 1
  })
  ;(checkWebGpuSupport as jest.Mock).mockResolvedValue(true)
  ;(fetchProfile as jest.Mock).mockResolvedValue(null)
  ;(isProfileComplete as jest.Mock).mockReturnValue(false)
  ;(isEmailValid as jest.Mock).mockReturnValue(true)
  ;(getStoredEmail as jest.Mock).mockReturnValue(null)
}

const defaultFeatureFlags = {
  flags: {},
  variants: {},
  initialized: true
}

function renderAvatarSetupPage(featureFlagsOverrides: Partial<typeof defaultFeatureFlags> = {}) {
  const featureFlagsValue = { ...defaultFeatureFlags, ...featureFlagsOverrides }

  return render(
    <MemoryRouter>
      <TranslationProvider locale="en" translations={translations} fallbackLocale="en">
        <DclThemeProvider theme={darkTheme}>
          <FeatureFlagsContext.Provider value={featureFlagsValue}>
            <AvatarSetupPage />
          </FeatureFlagsContext.Provider>
        </DclThemeProvider>
      </TranslationProvider>
    </MemoryRouter>
  )
}

describe('AvatarSetupPage', () => {
  beforeEach(() => {
    setupDefaultMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when feature flags are not initialized', () => {
    describe('and the connection is still loading', () => {
      beforeEach(() => {
        ;(useCurrentConnectionData as jest.Mock).mockReturnValue({
          isLoading: true,
          account: undefined,
          identity: undefined,
          provider: undefined,
          providerType: undefined,
          chainId: undefined
        })
      })

      it('should render the loading state', () => {
        const { getByText } = renderAvatarSetupPage({ initialized: false })
        expect(getByText('Confirming login...')).toBeInTheDocument()
      })
    })
  })

  describe('when the user has no account', () => {
    beforeEach(() => {
      ;(useCurrentConnectionData as jest.Mock).mockReturnValue({
        isLoading: false,
        account: undefined,
        identity: undefined,
        provider: undefined,
        providerType: undefined,
        chainId: undefined
      })
    })

    it('should navigate to the login page', async () => {
      renderAvatarSetupPage()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('when the user has an account but no identity', () => {
    beforeEach(() => {
      ;(useCurrentConnectionData as jest.Mock).mockReturnValue({
        isLoading: false,
        account: MOCK_ACCOUNT,
        identity: undefined,
        provider: undefined,
        providerType: undefined,
        chainId: undefined
      })
    })

    it('should navigate to the login page', async () => {
      renderAvatarSetupPage()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('when WebGPU is not supported', () => {
    beforeEach(() => {
      ;(checkWebGpuSupport as jest.Mock).mockResolvedValue(false)
    })

    it('should navigate to the setup page', async () => {
      renderAvatarSetupPage()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/setup')
      })
    })
  })

  describe('when the user has a complete profile', () => {
    beforeEach(() => {
      ;(fetchProfile as jest.Mock).mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      ;(isProfileComplete as jest.Mock).mockReturnValue(true)
    })

    it('should redirect away', async () => {
      renderAvatarSetupPage()

      await waitFor(() => {
        expect(mockRedirect).toHaveBeenCalled()
      })
    })
  })

  describe('when initialization completes successfully', () => {
    it('should render the welcome title', async () => {
      const { getByText } = renderAvatarSetupPage()

      await waitFor(() => {
        expect(getByText('Welcome to')).toBeInTheDocument()
      })
    })

    it('should render the username input', async () => {
      const { getByPlaceholderText } = renderAvatarSetupPage()

      await waitFor(() => {
        expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
      })
    })

    it('should render the email input', async () => {
      const { getByPlaceholderText } = renderAvatarSetupPage()

      await waitFor(() => {
        expect(getByPlaceholderText('Enter your email')).toBeInTheDocument()
      })
    })

    it('should render the terms checkbox', async () => {
      const { getByRole } = renderAvatarSetupPage()

      await waitFor(() => {
        expect(getByRole('checkbox')).toBeInTheDocument()
      })
    })

    it('should render the continue button', async () => {
      const { getByRole } = renderAvatarSetupPage()

      await waitFor(() => {
        expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).toBeInTheDocument()
      })
    })

    describe('and a stored email exists from a web2 login', () => {
      beforeEach(() => {
        ;(getStoredEmail as jest.Mock).mockReturnValue('stored@email.com')
      })

      it('should pre-fill the email and hide the email input', async () => {
        const { queryByPlaceholderText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(queryByPlaceholderText('Enter your email')).not.toBeInTheDocument()
        })
      })
    })

    describe('and the user types a username', () => {
      it('should update the username input value', async () => {
        const { getByPlaceholderText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        const usernameInput = getByPlaceholderText('Enter your username')
        fireEvent.change(usernameInput, { target: { value: 'TestUser' } })

        expect(usernameInput).toHaveValue('TestUser')
      })

      it('should persist the username to sessionStorage', async () => {
        const { getByPlaceholderText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })

        expect(sessionStorage.getItem('dcl_avatar_setup_username')).toBe('TestUser')
      })
    })

    describe('and the username contains special characters', () => {
      it('should show a validation error', async () => {
        const { getByPlaceholderText, getByText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'Test@User!' } })

        expect(getByText('Only letters and numbers are supported')).toBeInTheDocument()
      })
    })

    describe('and the username exceeds the character limit', () => {
      it('should disable the continue button', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), {
          target: { value: 'ThisUsernameIsTooLong' }
        })

        expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).toBeDisabled()
      })
    })

    describe('and the user checks the terms checkbox', () => {
      it('should track the terms check event', async () => {
        const { getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByRole('checkbox')).toBeInTheDocument()
        })

        fireEvent.click(getByRole('checkbox'))

        expect(mockTrackCheckTermsOfService).toHaveBeenCalled()
      })

      it('should persist the terms check to sessionStorage', async () => {
        const { getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByRole('checkbox')).toBeInTheDocument()
        })

        fireEvent.click(getByRole('checkbox'))

        expect(sessionStorage.getItem('dcl_avatar_setup_is_terms_checked')).toBe('true')
      })
    })

    describe('and the continue button is disabled', () => {
      describe('and the username is empty', () => {
        it('should keep the button disabled', async () => {
          const { getByRole } = renderAvatarSetupPage()

          await waitFor(() => {
            expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).toBeInTheDocument()
          })

          expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).toBeDisabled()
        })
      })

      describe('and the terms are not checked', () => {
        it('should keep the button disabled', async () => {
          const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

          await waitFor(() => {
            expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
          })

          fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })

          expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).toBeDisabled()
        })
      })
    })

    describe('and the user has an invalid email when the preview loads', () => {
      beforeEach(() => {
        ;(isEmailValid as jest.Mock).mockReturnValue(false)
        ;(WearablePreview.createController as jest.Mock).mockReturnValue({
          scene: { setUsername: jest.fn().mockResolvedValue(undefined) }
        })
      })

      it('should display the email error in the error box', async () => {
        const { getByPlaceholderText, getByRole, getByText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        // Fill username and invalid email (must contain @ to pass the useMemo emailError check
        // so the button can be enabled, but isEmailValid returns false in handleContinueClick)
        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.change(getByPlaceholderText('Enter your email'), { target: { value: 'invalid@x' } })
        fireEvent.click(getByRole('checkbox'))

        // Trigger onLoad — the useEffect auto-calls handleContinueClick which validates
        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(getByText('Something went wrong')).toBeInTheDocument()
        })
      })

      it('should not call WearablePreview.createController', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.change(getByPlaceholderText('Enter your email'), { target: { value: 'invalid@x' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(handleError).toHaveBeenCalled()
        })

        expect(WearablePreview.createController).not.toHaveBeenCalled()
      })

      it('should keep the preview loaded so the user can retry', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.change(getByPlaceholderText('Enter your email'), { target: { value: 'invalid@x' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(handleError).toHaveBeenCalled()
        })

        // Button should remain enabled — the iframe is still loaded, only showWearablePreview was reset
        expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).not.toBeDisabled()
      })
    })

    describe('and the preview finishes loading with valid form data', () => {
      let mockSetUsername: jest.Mock

      beforeEach(() => {
        mockSetUsername = jest.fn().mockResolvedValue(undefined)
        ;(WearablePreview.createController as jest.Mock).mockReturnValue({
          scene: { setUsername: mockSetUsername }
        })
      })

      it('should call setUsername on the preview controller via the useEffect', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.click(getByRole('checkbox'))

        // Trigger onLoad — the useEffect auto-calls handleContinueClick
        // because username is set, terms checked, and preview loaded
        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(mockSetUsername).toHaveBeenCalledWith('TestUser')
        })
      })

      it('should track the terms of service success event only once', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(mockTrackTermsOfServiceSuccess).toHaveBeenCalledTimes(1)
        })

        expect(mockTrackTermsOfServiceSuccess).toHaveBeenCalledWith({
          ethAddress: MOCK_ACCOUNT,
          isGuest: false,
          email: undefined,
          name: 'TestUser'
        })
      })
    })

    describe('and the preview controller throws an error when the preview loads', () => {
      beforeEach(() => {
        ;(WearablePreview.createController as jest.Mock).mockReturnValue({
          scene: { setUsername: jest.fn().mockRejectedValue(new Error('Request timeout for setUsername')) }
        })
      })

      it('should display the error in the error box', async () => {
        const { getByPlaceholderText, getByRole, getByText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(getByText('Something went wrong')).toBeInTheDocument()
          expect(getByText('Request timeout for setUsername')).toBeInTheDocument()
        })
      })

      it('should call handleError with the error context', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Error setting up avatar')
        })
      })

      it('should not track the terms of service success event', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(handleError).toHaveBeenCalled()
        })

        expect(mockTrackTermsOfServiceSuccess).not.toHaveBeenCalled()
      })

      it('should keep the preview loaded so the user can retry', async () => {
        const { getByPlaceholderText, getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
        })

        fireEvent.change(getByPlaceholderText('Enter your username'), { target: { value: 'TestUser' } })
        fireEvent.click(getByRole('checkbox'))

        const triggerOnload = document.querySelector('[data-testid="trigger-onload"]') as HTMLElement
        await act(async () => {
          fireEvent.click(triggerOnload)
        })

        await waitFor(() => {
          expect(handleError).toHaveBeenCalled()
        })

        // Button should remain enabled — the iframe is still loaded, only showWearablePreview was reset
        expect(getByRole('button', { name: 'CUSTOMIZE MY AVATAR' })).not.toBeDisabled()
      })
    })

    describe('and the user restores state from sessionStorage', () => {
      beforeEach(() => {
        sessionStorage.setItem('dcl_avatar_setup_username', 'SavedUser')
        sessionStorage.setItem('dcl_avatar_setup_email', 'saved@email.com')
        sessionStorage.setItem('dcl_avatar_setup_is_terms_checked', 'true')
      })

      it('should restore the username from sessionStorage', async () => {
        const { getByPlaceholderText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your username')).toHaveValue('SavedUser')
        })
      })

      it('should restore the email from sessionStorage', async () => {
        const { getByPlaceholderText } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByPlaceholderText('Enter your email')).toHaveValue('saved@email.com')
        })
      })

      it('should restore the terms checkbox from sessionStorage', async () => {
        const { getByRole } = renderAvatarSetupPage()

        await waitFor(() => {
          expect(getByRole('checkbox')).toBeChecked()
        })
      })
    })
  })
})
