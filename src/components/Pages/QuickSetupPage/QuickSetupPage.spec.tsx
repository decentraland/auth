import { fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { subscribeToNewsletter } from '../SetupPage/utils'
import { QuickSetupPage } from './QuickSetupPage'

// --- Mocks ---

const mockRedirect = jest.fn()
jest.mock('../../../hooks/redirection', () => ({
  useAfterLoginRedirection: () => ({ url: 'https://decentraland.org/', redirect: mockRedirect, hasExplicitRedirect: true })
}))

jest.mock('../../../hooks/useSkipSetup', () => ({
  useSkipSetup: () => false
}))

let mockAccount: string | undefined = '0xTestAccount'
let mockIdentity: object | undefined = { authChain: [] }
jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: () => ({
    account: mockAccount,
    identity: mockIdentity,
    isLoading: false
  })
}))

jest.mock('../../../shared/onboarding/trackCheckpoint', () => ({
  trackCheckpoint: jest.fn()
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn().mockReturnValue('Error message')
}))

jest.mock('../SetupPage/utils', () => ({
  deployProfileFromDefault: jest.fn().mockResolvedValue(undefined),
  subscribeToNewsletter: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('../../CustomWearablePreview', () => ({
  CustomWearablePreview: ({ profile }: { profile: string }) => <div data-testid="wearable-preview" data-profile={profile} />
}))

jest.mock('decentraland-ui2', () => ({
  useMobileMediaQuery: () => false,

  Logo: ({ size }: { size: string }) => <div data-testid="dcl-logo" data-size={size} />,

  CircularProgress: () => <div data-testid="spinner" />,
  styled: jest.requireActual('decentraland-ui2').styled,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Box: jest.requireActual('decentraland-ui2').Box,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Button: jest.requireActual('decentraland-ui2').Button,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Typography: jest.requireActual('decentraland-ui2').Typography,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  TextField: jest.requireActual('decentraland-ui2').TextField,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Checkbox: jest.requireActual('decentraland-ui2').Checkbox,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  FormControlLabel: jest.requireActual('decentraland-ui2').FormControlLabel,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Link: jest.requireActual('decentraland-ui2').Link
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const translations: Record<string, string> = {
        'quick_setup.welcome': 'Welcome to',
        'quick_setup.decentraland': 'Decentraland!',
        'quick_setup.username_label': 'Username*',
        'quick_setup.username_placeholder': 'Enter your username',
        'quick_setup.email_label': 'Email',
        'quick_setup.email_placeholder': 'Enter your email',
        'quick_setup.email_helper': 'Subscribe to newsletter',
        'quick_setup.newsletter_subscribe': 'Subscribe to newsletter for updates on features, events, contests, and more.',
        'quick_setup.terms_of_use': 'Terms of Use',
        'quick_setup.privacy_policy': 'Privacy Policy',
        'quick_setup.lets_go': "LET'S GO",
        'quick_setup.deploying': 'DEPLOYING...',
        'quick_setup.body_type_a': 'BODY TYPE A',
        'quick_setup.body_type_b': 'BODY TYPE B',
        'quick_setup.randomize': 'RANDOMIZE',
        'quick_setup.customize_later': 'You can customize your avatar later.',
        'quick_setup.ready_to_jump_in': `${params?.name} is Ready to Jump In!`,
        'quick_setup.success': 'SUCCESS'
      }
      /* eslint-enable @typescript-eslint/naming-convention */
      return translations[key] ?? key
    }
  })
}))

jest.mock('../../../modules/config', () => ({
  config: {
    get: () => 'https://wearable-preview.decentraland.zone',
    is: () => false
  }
}))

describe('QuickSetupPage', () => {
  beforeEach(() => {
    mockAccount = '0xTestAccount'
    mockIdentity = { authChain: [] }
    mockRedirect.mockClear()
  })

  it('should render the welcome title and form', () => {
    const { getByText, getByPlaceholderText } = render(<QuickSetupPage />)
    expect(getByText('Welcome to')).toBeInTheDocument()
    expect(getByText('Decentraland!')).toBeInTheDocument()
    expect(getByText('Username*')).toBeInTheDocument()
    expect(getByPlaceholderText('Enter your username')).toBeInTheDocument()
    expect(getByPlaceholderText('Enter your email')).toBeInTheDocument()
  })

  it('should render the DCL logo', () => {
    const { getByTestId } = render(<QuickSetupPage />)
    expect(getByTestId('dcl-logo')).toBeInTheDocument()
  })

  it('should render the avatar preview on desktop', () => {
    const { getByTestId } = render(<QuickSetupPage />)
    expect(getByTestId('wearable-preview')).toBeInTheDocument()
  })

  it('should render randomize and body type buttons', () => {
    const { getByText } = render(<QuickSetupPage />)
    expect(getByText('RANDOMIZE')).toBeInTheDocument()
    expect(getByText('BODY TYPE A')).toBeInTheDocument()
  })

  describe("when Let's Go button is disabled", () => {
    it('should be disabled when username is empty', () => {
      const { getByText } = render(<QuickSetupPage />)
      const button = getByText("LET'S GO").closest('button')
      expect(button).toBeDisabled()
    })

    it('should be disabled when TOS is not accepted', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText } = render(<QuickSetupPage />)
      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      const button = getByText("LET'S GO").closest('button')
      expect(button).toBeDisabled()
    })
  })

  describe('when username is entered and TOS accepted', () => {
    it("should enable the Let's Go button", async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText, getByRole } = render(<QuickSetupPage />)
      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      const checkbox = getByRole('checkbox')
      await user.click(checkbox)
      const button = getByText("LET'S GO").closest('button')
      expect(button).not.toBeDisabled()
    })
  })

  describe('body type dropdown', () => {
    it('should toggle dropdown on click', async () => {
      const user = userEvent.setup()
      const { getByText, queryByText } = render(<QuickSetupPage />)
      expect(queryByText('BODY TYPE B')).not.toBeInTheDocument()
      await user.click(getByText('BODY TYPE A'))
      expect(getByText('BODY TYPE B')).toBeInTheDocument()
    })

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      const { getByText, queryAllByText } = render(<QuickSetupPage />)
      await user.click(getByText('BODY TYPE A'))
      // Both A and B should be in the dropdown
      expect(queryAllByText(/BODY TYPE/)).toHaveLength(3) // button + 2 dropdown items
      // Click outside
      fireEvent.mouseDown(document.body)
      await waitFor(() => {
        expect(queryAllByText(/BODY TYPE/)).toHaveLength(1) // just the button
      })
    })

    it('should change body type when selecting from dropdown', async () => {
      const user = userEvent.setup()
      const { getByText } = render(<QuickSetupPage />)
      await user.click(getByText('BODY TYPE A'))
      // Click Body Type B in dropdown
      const items = document.querySelectorAll('[class*="BodyTypeDropdownItem"]')
      if (items[1]) {
        await user.click(items[1])
      }
      expect(getByText('BODY TYPE B')).toBeInTheDocument()
    })

    describe('default profile range per body type', () => {
      // Catalyst convention (verified against peer.decentraland.org):
      //   defaults 1-80   → BaseFemale
      //   defaults 81-160 → BaseMale
      // Body Type A is displayed with the man icon → must map to the Male range (81-160).
      // Body Type B is displayed with the woman icon → must map to the Female range (1-80).
      const extractDefaultNumber = (profile: string): number => {
        const match = /^default(\d+)$/.exec(profile)
        return match ? Number(match[1]) : NaN
      }

      it('should use a default in the BaseMale range (81-160) when Body Type A is active', () => {
        const { getByTestId } = render(<QuickSetupPage />)
        const profile = getByTestId('wearable-preview').getAttribute('data-profile') ?? ''
        const n = extractDefaultNumber(profile)
        expect(n).toBeGreaterThanOrEqual(81)
        expect(n).toBeLessThanOrEqual(160)
      })

      it('should use a default in the BaseFemale range (1-80) when Body Type B is selected', async () => {
        const user = userEvent.setup()
        const { getByText, getByTestId } = render(<QuickSetupPage />)
        // Open the dropdown (clicking the button that currently reads "BODY TYPE A")
        await user.click(getByText('BODY TYPE A'))
        // After opening, the dropdown contains two "BODY TYPE B" occurrences are NOT expected —
        // only one (the dropdown item). Click it to select Body Type B.
        await user.click(getByText('BODY TYPE B'))
        await waitFor(() => {
          const profile = getByTestId('wearable-preview').getAttribute('data-profile') ?? ''
          const n = extractDefaultNumber(profile)
          expect(n).toBeGreaterThanOrEqual(1)
          expect(n).toBeLessThanOrEqual(80)
        })
      })
    })
  })

  describe('celebration screen', () => {
    it('should show celebration screen after submitting', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText, getByRole } = render(<QuickSetupPage />)

      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      const checkbox = getByRole('checkbox')
      await user.click(checkbox)

      const button = getByText("LET'S GO").closest('button')!
      await user.click(button)

      await waitFor(() => {
        expect(getByText('Your account is Ready!')).toBeInTheDocument()
      })
      expect(getByText('Start Exploring')).toBeInTheDocument()
    })

    it('should call redirect when clicking SUCCESS', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText, getByRole } = render(<QuickSetupPage />)

      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      await user.click(getByRole('checkbox'))
      await user.click(getByText("LET'S GO").closest('button')!)

      await waitFor(() => {
        expect(getByText('Start Exploring')).toBeInTheDocument()
      })

      await user.click(getByText('Start Exploring').closest('button')!)
      expect(mockRedirect).toHaveBeenCalled()
    })
  })

  describe('username validation', () => {
    it('should show character counter', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText } = render(<QuickSetupPage />)
      expect(getByText('0/15')).toBeInTheDocument()
      await user.type(getByPlaceholderText('Enter your username'), 'Hello')
      expect(getByText('5/15')).toBeInTheDocument()
    })
  })

  describe('when the user signed in with a flow that already collected the email (Google / email + OTP)', () => {
    const inheritedEmail = 'inherited@example.com'

    beforeEach(() => {
      ;(subscribeToNewsletter as jest.Mock).mockClear()
      localStorage.setItem('dcl_thirdweb_user_email', inheritedEmail)
    })

    afterEach(() => {
      localStorage.removeItem('dcl_thirdweb_user_email')
      localStorage.removeItem('dcl_magic_user_email')
    })

    it('should not render the email input field', () => {
      const { queryByPlaceholderText } = render(<QuickSetupPage />)
      expect(queryByPlaceholderText('Enter your email')).not.toBeInTheDocument()
    })

    it('should render the newsletter subscription checkbox', () => {
      const { getByText } = render(<QuickSetupPage />)
      expect(getByText('Subscribe to newsletter for updates on features, events, contests, and more.')).toBeInTheDocument()
    })

    it('should subscribe with the inherited email when the newsletter checkbox is checked', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText, getAllByRole } = render(<QuickSetupPage />)

      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      // Checkboxes order: [newsletter, terms]
      const checkboxes = getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      await user.click(getByText("LET'S GO").closest('button')!)

      await waitFor(() => {
        expect(subscribeToNewsletter).toHaveBeenCalledWith(inheritedEmail)
      })
    })

    it('should not subscribe when the newsletter checkbox is left unchecked', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText, getAllByRole } = render(<QuickSetupPage />)

      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      // Only check the terms checkbox (index 1)
      const checkboxes = getAllByRole('checkbox')
      await user.click(checkboxes[1])

      await user.click(getByText("LET'S GO").closest('button')!)

      await waitFor(() => {
        expect(getByText('Your account is Ready!')).toBeInTheDocument()
      })
      expect(subscribeToNewsletter).not.toHaveBeenCalled()
    })
  })

  describe('when only the Magic-issued email is stored in localStorage', () => {
    const magicEmail = 'magic@example.com'

    beforeEach(() => {
      ;(subscribeToNewsletter as jest.Mock).mockClear()
      localStorage.removeItem('dcl_thirdweb_user_email')
      localStorage.setItem('dcl_magic_user_email', magicEmail)
    })

    afterEach(() => {
      localStorage.removeItem('dcl_magic_user_email')
    })

    it('should hide the email input and use the Magic email when subscribing', async () => {
      const user = userEvent.setup()
      const { getByText, getByPlaceholderText, queryByPlaceholderText, getAllByRole } = render(<QuickSetupPage />)

      expect(queryByPlaceholderText('Enter your email')).not.toBeInTheDocument()

      await user.type(getByPlaceholderText('Enter your username'), 'TestUser')
      const checkboxes = getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      await user.click(getByText("LET'S GO").closest('button')!)

      await waitFor(() => {
        expect(subscribeToNewsletter).toHaveBeenCalledWith(magicEmail)
      })
    })
  })
})
