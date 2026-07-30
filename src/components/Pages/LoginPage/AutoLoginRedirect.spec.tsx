/* eslint-disable import/order */
import { render, waitFor } from '@testing-library/react'

const mockEnsureProfile = jest.fn()
const mockRedirect = jest.fn()
const mockConnectToProvider = jest.fn()
const mockConnectToSocialProvider = jest.fn()
const mockGetIdentitySignature = jest.fn()
const mockCheckClockSync = jest.fn()
const mockNavigate = jest.fn()
let mockSkipSetup = false

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (id: string) => id })
}))

jest.mock('decentraland-ui2', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  CircularProgress: () => <div data-testid="circular-progress" />
}))

jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ trackLoginClick: jest.fn(), trackLoginSuccess: jest.fn() })
}))

jest.mock('../../../hooks/useEnsureProfile', () => ({
  useEnsureProfile: () => ({ ensureProfile: mockEnsureProfile })
}))

jest.mock('../../../hooks/usePostLoginRedirect', () => ({
  usePostLoginRedirect: () => ({
    redirect: mockRedirect,
    redirectTo: 'https://decentraland.org/download',
    skipSetup: mockSkipSetup
  })
}))

jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: () => ({ getIdentitySignature: mockGetIdentitySignature })
}))

jest.mock('../../../shared/onboarding/markReturningUser', () => ({
  markReturningUser: jest.fn()
}))

jest.mock('../../../shared/onboarding/trackCheckpoint', () => ({
  trackCheckpoint: jest.fn()
}))

jest.mock('../../../shared/utils/clockSync', () => ({
  checkClockSync: () => mockCheckClockSync()
}))

jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn()
}))

jest.mock('../../AnimatedBackground', () => ({
  AnimatedBackground: () => <div data-testid="animated-background" />
}))

jest.mock('../../ConnectionModal/ConnectionLayout.styled', () => ({
  ConnectionContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConnectionTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DecentralandLogo: () => <div data-testid="logo" />,
  ProgressContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('../../Pages/CallbackPage/CallbackPage.styled', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Wrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('../../Pages/LoginErrorPage', () => ({
  LoginErrorPage: () => <div data-testid="login-error-page" />
}))

jest.mock('./utils', () => ({
  connectToProvider: (type: string) => mockConnectToProvider(type),
  connectToSocialProvider: (...args: unknown[]) => mockConnectToSocialProvider(...args),
  isMagicTestMode: () => false,
  isSocialLogin: () => false
}))

import { AutoLoginRedirect } from './AutoLoginRedirect'
import { ConnectionOptionType } from '../../Connection/Connection.types'

const REFERRER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const ACCOUNT = '0x1234567890abcdef1234567890abcdef12345678'

const originalLocation = window.location
const originalEthereum = (window as { ethereum?: unknown }).ethereum

const setSearch = (search: string) => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: new URL(`http://localhost/auth/login?${search}`)
  })
}

beforeEach(() => {
  ;(window as { ethereum?: unknown }).ethereum = {}
  mockSkipSetup = false
  mockConnectToProvider.mockResolvedValue({ account: ACCOUNT })
  mockGetIdentitySignature.mockResolvedValue({ authChain: [] })
  mockCheckClockSync.mockResolvedValue(true)
  mockEnsureProfile.mockResolvedValue(null)
})

afterEach(() => {
  Object.defineProperty(window, 'location', { writable: true, value: originalLocation })
  ;(window as { ethereum?: unknown }).ethereum = originalEthereum
  jest.resetAllMocks()
})

describe('when auto-logging in with a wallet and the URL carries a referrer', () => {
  it('should forward the referrer to ensureProfile so setup can record the referral', async () => {
    setSearch(`loginMethod=metamask&referrer=${REFERRER}&redirectTo=https%3A%2F%2Fdecentraland.org%2Fdownload`)

    render(<AutoLoginRedirect connectionType={ConnectionOptionType.METAMASK} />)

    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalled())
    expect(mockEnsureProfile).toHaveBeenCalledWith(ACCOUNT, expect.anything(), expect.objectContaining({ referrer: REFERRER }))
  })
})

describe('when the URL carries no referrer', () => {
  it('should pass a null referrer', async () => {
    setSearch('loginMethod=metamask&redirectTo=https%3A%2F%2Fdecentraland.org%2Fdownload')

    render(<AutoLoginRedirect connectionType={ConnectionOptionType.METAMASK} />)

    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalled())
    expect(mockEnsureProfile).toHaveBeenCalledWith(ACCOUNT, expect.anything(), expect.objectContaining({ referrer: null }))
  })
})

describe('when the referrer param is not a valid address', () => {
  it('should drop it instead of forwarding a bogus value', async () => {
    setSearch('loginMethod=metamask&referrer=not-an-address')

    render(<AutoLoginRedirect connectionType={ConnectionOptionType.METAMASK} />)

    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalled())
    expect(mockEnsureProfile).toHaveBeenCalledWith(ACCOUNT, expect.anything(), expect.objectContaining({ referrer: null }))
  })
})

describe('when the redirect targets an Explorer request', () => {
  it('should skip the profile check entirely', async () => {
    setSearch(`loginMethod=metamask&referrer=${REFERRER}&redirectTo=%2Fauth%2Frequests%2Fabc`)

    render(<AutoLoginRedirect connectionType={ConnectionOptionType.METAMASK} />)

    await waitFor(() => expect(mockRedirect).toHaveBeenCalled())
    expect(mockEnsureProfile).not.toHaveBeenCalled()
  })
})
