import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { fetchProfileWithStatus } from '../../../modules/profile'
import { isProfileComplete } from '../../../shared/profile'
import { createMockIdentity } from '../../../tests/mocks/profile'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { AvatarSetupPage } from '../AvatarSetupPage/AvatarSetupPage'
import { deployProfileFromAvatarShape } from '../AvatarSetupPage/utils'
import { QuickSetupPage } from '../QuickSetupPage/QuickSetupPage'
import { SetupPage } from './SetupPage'
import { deployProfileFromDefault } from './utils'

let mockConnection: { account: string; identity: ReturnType<typeof createMockIdentity>; isLoading: boolean }
let mockRedirect: jest.Mock
let mockTrack: jest.Mock
const mockSearch = new URLSearchParams()
jest.mock('react-router-dom', () => ({ useSearchParams: () => [mockSearch] }))
jest.mock('@dcl/hooks', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../../../shared/connection', () => ({ useCurrentConnectionData: () => mockConnection }))
jest.mock('../../../hooks/redirection', () => ({ useAfterLoginRedirection: () => ({ url: '/home', redirect: mockRedirect }) }))
jest.mock('../../../hooks/navigation', () => ({ useNavigateWithSearchParams: () => mockRedirect }))
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackClick: mockTrack,
    trackAvatarEditSuccess: mockTrack,
    trackTermsOfServiceSuccess: mockTrack,
    trackStartAddingName: mockTrack,
    trackStartAddingEmail: mockTrack,
    trackCheckTermsOfService: mockTrack,
    trackAvatarCustomizationStep: mockTrack
  })
}))
jest.mock('../../../hooks/useTrackReferral', () => ({ useTrackReferral: () => ({ track: mockTrack }) }))
jest.mock('../../../hooks/useDisabledCatalysts', () => ({ useDisabledCatalysts: () => [] }))
jest.mock('../../../modules/profile', () => ({ fetchProfileWithStatus: jest.fn() }))
jest.mock('../../../shared/profile', () => ({ isProfileComplete: jest.fn() }))
jest.mock('../../../shared/onboarding/getStoredEmail', () => ({ getStoredEmail: () => null }))
jest.mock('../../../shared/onboarding/trackCheckpoint', () => ({ trackCheckpoint: jest.fn() }))
jest.mock('../../../shared/utils/webgpu', () => ({ checkWebGpuSupport: () => Promise.resolve(true) }))
jest.mock('../../../modules/config', () => ({ config: { get: () => 'https://preview.example', is: () => false } }))
jest.mock('../../CustomWearablePreview', () => ({ CustomWearablePreview: () => null }))
jest.mock('../../AnimatedBackground', () => ({ AnimatedBackground: () => null }))
jest.mock('../QuickSetupPage/celebratePrefetch', () => ({ prefetchCelebrateAnimation: jest.fn(), getCelebrateAnimation: jest.fn() }))
jest.mock('./utils', () => ({ deployProfileFromDefault: jest.fn(), subscribeToNewsletter: jest.fn() }))
jest.mock('../AvatarSetupPage/utils', () => ({ deployProfileFromAvatarShape: jest.fn() }))

describe.each([SetupPage, QuickSetupPage, AvatarSetupPage])('when %p checks profile readiness', pageComponent => {
  const Page = pageComponent
  let page: ReturnType<typeof render>
  let user: ReturnType<typeof userEvent.setup>
  let resolveProfile: (result: Awaited<ReturnType<typeof fetchProfileWithStatus>>) => void
  let missingProfile: Awaited<ReturnType<typeof fetchProfileWithStatus>>
  let renderPage: () => React.ReactElement

  beforeEach(() => {
    mockConnection = {
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      identity: createMockIdentity('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      isLoading: false
    }
    mockRedirect = jest.fn()
    mockTrack = jest.fn()
    user = userEvent.setup()
    missingProfile = { profile: null, couldNotDetermine: false }
    jest.mocked(fetchProfileWithStatus).mockResolvedValue(missingProfile)
    jest.mocked(isProfileComplete).mockReturnValue(false)
    sessionStorage.clear()
    renderPage = () => (
      <DclThemeProvider theme={darkTheme}>
        <FeatureFlagsContext.Provider value={{ initialized: true, flags: {}, variants: {} }}>
          <Page />
        </FeatureFlagsContext.Provider>
      </DclThemeProvider>
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the connected account changes after initialization', () => {
    beforeEach(async () => {
      page = render(renderPage())
      if (Page === SetupPage) await user.click(await screen.findByRole('button', { name: 'common.continue' }))
      await screen.findAllByRole('textbox')
      await user.type(screen.getAllByRole('textbox')[0], 'TestUser')
      await user.click(screen.getByRole('checkbox'))
      jest.mocked(fetchProfileWithStatus).mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveProfile = resolve
          })
      )
      mockConnection = {
        ...mockConnection,
        account: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        identity: createMockIdentity('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      }
      page.rerender(renderPage())
      await waitFor(() => expect(fetchProfileWithStatus).toHaveBeenCalledTimes(2))
    })

    it('should hide the old form until the replacement account is checked', () => {
      expect(screen.queryAllByRole('textbox')).toHaveLength(0)
      fireEvent(
        window,
        new MessageEvent('message', {
          origin: 'https://preview.example',
          data: { type: 'controller_response', payload: { id: 'customization-done', result: {} } }
        })
      )
      expect(deployProfileFromDefault).not.toHaveBeenCalled()
      expect(deployProfileFromAvatarShape).not.toHaveBeenCalled()
    })

    it('should resume onboarding once the replacement account is confirmed to need it', async () => {
      await act(async () => resolveProfile(missingProfile))
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
    })

    it('should redirect instead of reopening the form for an existing profile', async () => {
      jest.mocked(isProfileComplete).mockReturnValue(true)
      await act(async () =>
        resolveProfile({ profile: { avatars: [] } as unknown as NonNullable<typeof missingProfile.profile>, couldNotDetermine: false })
      )
      expect(mockRedirect).toHaveBeenCalledTimes(1)
      expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    })
  })

  describe('and an old account lookup resolves after the account changes', () => {
    beforeEach(async () => {
      jest.mocked(fetchProfileWithStatus).mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveProfile = resolve
          })
      )
      page = render(renderPage())
      await waitFor(() => expect(fetchProfileWithStatus).toHaveBeenCalledTimes(1))
      jest.mocked(fetchProfileWithStatus).mockImplementationOnce(() => new Promise(() => undefined))
      mockConnection = {
        ...mockConnection,
        account: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        identity: createMockIdentity('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      }
      page.rerender(renderPage())
      await waitFor(() => expect(fetchProfileWithStatus).toHaveBeenCalledTimes(2))
    })

    it('should ignore the old readiness result', async () => {
      await act(async () => resolveProfile(missingProfile))
      expect(screen.queryAllByRole('textbox')).toHaveLength(0)
      expect(screen.queryByRole('button', { name: 'common.continue' })).not.toBeInTheDocument()
    })

    it('should ignore an old existing-profile result without redirecting the new account', async () => {
      jest.mocked(isProfileComplete).mockReturnValue(true)
      await act(async () =>
        resolveProfile({ profile: { avatars: [] } as unknown as NonNullable<typeof missingProfile.profile>, couldNotDetermine: false })
      )
      expect(mockRedirect).not.toHaveBeenCalled()
    })
  })
})
