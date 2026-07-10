/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderType } from '@dcl/schemas'
import { fetchProfile } from '../../../modules/profile'
import {
  DifferentSenderError,
  ExpiredRequestError,
  ImpersonatedSignInError,
  IpValidationError,
  RequestFulfilledError
} from '../../../shared/auth'
import { isBridgeOnlyEnabled } from '../../../shared/locations'
import { isProfileComplete } from '../../../shared/profile'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { FeatureFlagsKeys } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import { RequestPage } from './RequestPage'
import { getSigninDeeplink } from './utils'

// --- Navigation ---
const mockNavigate = jest.fn()
jest.mock('../../../hooks/navigation', () => ({
  useNavigateWithSearchParams: () => mockNavigate
}))

let mockSkipSetup = false
jest.mock('../../../hooks/useSkipSetup', () => ({
  useSkipSetup: () => mockSkipSetup
}))

// --- Connection ---
let mockConnectionData: Record<string, any>
jest.mock('../../../shared/connection', () => ({
  useCurrentConnectionData: () => mockConnectionData,
  isSocialProviderType: jest.requireActual('../../../shared/connection/socialProviders').isSocialProviderType
}))

// --- Ensure Profile ---
const mockEnsureProfile = jest.fn()
jest.mock('../../../hooks/useEnsureProfile', () => ({
  useEnsureProfile: () => ({ ensureProfile: mockEnsureProfile })
}))

// --- Target Config ---
let mockTargetConfig: Record<string, any>
jest.mock('../../../hooks/targetConfig', () => ({
  useTargetConfig: () => [mockTargetConfig, 'default']
}))

// --- Analytics ---
jest.mock('../../../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackClick: jest.fn()
  })
}))
jest.mock('../../../modules/analytics/segment', () => ({
  getAnalytics: () => null
}))

// --- Auth Server Client ---
const mockRecover = jest.fn()
const mockSendSuccessfulOutcome = jest.fn()
const mockSendFailedOutcome = jest.fn()
const mockNotifyRequestNeedsValidation = jest.fn()
const mockPostIdentity = jest.fn()
const mockSimulateTransaction = jest.fn()
jest.mock('../../../shared/auth', () => {
  const actual = jest.requireActual('../../../shared/auth')
  return {
    ...actual,
    createAuthServerHttpClient: () => ({
      recover: mockRecover,
      sendSuccessfulOutcome: mockSendSuccessfulOutcome,
      sendFailedOutcome: mockSendFailedOutcome,
      notifyRequestNeedsValidation: mockNotifyRequestNeedsValidation,
      postIdentity: mockPostIdentity,
      simulateTransaction: mockSimulateTransaction
    })
  }
})

// --- Shared modules ---
jest.mock('../../../shared/locations', () => ({
  extractReferrerFromSearchParameters: jest.fn().mockReturnValue(null),
  isBridgeOnlyEnabled: jest.fn().mockReturnValue(false),
  CLIENT_LOGIN_REQUEST_ID: 'client-login',
  buildRequestPageUrl: (requestId: string, targetConfigId: string) => `/auth/requests/${requestId}?targetConfigId=${targetConfigId}`
}))
jest.mock('../../../shared/utils/analytics', () => ({
  identifyUser: jest.fn()
}))
jest.mock('../../../shared/utils/errorHandler', () => ({
  handleError: jest.fn().mockReturnValue('An error occurred')
}))
jest.mock('../../../shared/errors', () => ({
  isErrorWithMessage: jest.fn().mockReturnValue(true),
  isRpcError: jest.fn().mockReturnValue(false),
  isUserRejectedTransaction: jest.fn().mockReturnValue(false)
}))
jest.mock('../../../modules/profile', () => ({
  fetchProfile: jest.fn()
}))
jest.mock('../../../shared/profile', () => ({
  isProfileComplete: jest.fn().mockReturnValue(true)
}))
jest.mock('../../../modules/config', () => ({
  config: { get: jest.fn().mockReturnValue('10000') }
}))
jest.mock('../../../shared/notifications', () => ({
  sendTipNotification: jest.fn()
}))

// --- Viem ---
const mockGetAddresses = jest.fn()
const mockSignMessage = jest.fn()
const mockGetBalance = jest.fn()
const mockGetChainId = jest.fn()
const mockEstimateFeesPerGas = jest.fn()
const mockEstimateGas = jest.fn()
const mockWalletRequest = jest.fn()

const mockPublicClient = {
  getBalance: (...args: any[]) => mockGetBalance(...args),
  getChainId: (...args: any[]) => mockGetChainId(...args),
  estimateFeesPerGas: (...args: any[]) => mockEstimateFeesPerGas(...args),
  estimateGas: (...args: any[]) => mockEstimateGas(...args)
}

const mockWalletClient = {
  getAddresses: () => mockGetAddresses(),
  signMessage: (...args: any[]) => mockSignMessage(...args),
  request: (...args: any[]) => mockWalletRequest(...args)
}

jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => mockPublicClient),
  createWalletClient: jest.fn(() => mockWalletClient),
  custom: jest.fn((p: any) => p),
  formatEther: jest.fn().mockReturnValue('0.01'),
  mainnet: { id: 1 }
}))

// --- Views (mock them to be simple identifiable components) ---
jest.mock('./Views', () => ({
  LoadingRequest: () => <div data-testid="loading-request">Loading...</div>,
  VerifySignIn: (props: any) => <div data-testid="verify-sign-in">Verify Sign In - Code: {props.code}</div>,
  DeniedSignIn: () => <div data-testid="denied-sign-in">Denied</div>,
  SignInComplete: () => <div data-testid="sign-in-complete">Complete</div>,
  SignInCompletePage: () => <div data-testid="sign-in-complete-page">Login Successful!</div>,
  TimeoutError: () => <div data-testid="timeout-error">Timeout</div>,
  DifferentAccountError: () => <div data-testid="different-account">Different Account</div>,
  IpValidationError: (props: any) => <div data-testid="ip-validation-error">IP Error: {props.reason}</div>,
  RecoverError: () => <div data-testid="recover-error">Recover Error</div>,
  SigningError: (props: any) => <div data-testid="signing-error">Signing Error: {props.error}</div>,
  WalletInteraction: (props: any) => (
    <div data-testid="wallet-interaction">
      <button data-testid="wallet-interaction-approve" onClick={props.onApprove}>
        approve
      </button>
      <button data-testid="wallet-interaction-deny" onClick={props.onDeny}>
        deny
      </button>
    </div>
  ),
  WalletInteractionComplete: () => <div data-testid="wallet-interaction-complete">Wallet Complete</div>,
  DeniedWalletInteraction: () => <div data-testid="denied-wallet-interaction">Denied Wallet</div>,
  ContinueInApp: () => <div data-testid="continue-in-app">Continue in App</div>,
  ClientLoginError: (props: any) => <div data-testid="client-login-error">Client Login Error: {props.error}</div>,
  TransferConfirmView: () => <div data-testid="transfer-confirm">Transfer Confirm</div>,
  TransferCompletedView: () => <div data-testid="transfer-completed">Transfer Completed</div>,
  TransferCanceledView: () => <div data-testid="transfer-canceled">Transfer Canceled</div>,
  TransactionConfirmDialog: (props: any) =>
    props.open ? (
      <div data-testid="transaction-confirm-dialog" data-sim={props.simulation?.status} data-gas-covered={String(props.gasCovered)}>
        Transaction Dialog
      </div>
    ) : null,
  SignatureRequestView: (props: any) => (
    <div
      data-testid="signature-request"
      data-method={props.method}
      data-meta={String(props.isMetaTransaction)}
      data-sim={props.simulation?.status}
    >
      <button data-testid="signature-approve" onClick={props.onApprove}>
        approve
      </button>
    </div>
  )
}))

// --- Utils ---
const mockIsSignatureMethod = jest.fn()
const mockExtractSignaturePayload = jest.fn()
const mockDecodeMetaTransactionTypedData = jest.fn()
const mockBuildSendTransactionSimulationPayload = jest.fn()
const mockCheckMetaTransactionSupport = jest.fn()
jest.mock('./utils', () => ({
  checkMetaTransactionSupport: (...args: any[]) => mockCheckMetaTransactionSupport(...args),
  decodeManaTransferData: jest.fn().mockReturnValue(null),
  decodeNftTransferData: jest.fn().mockReturnValue(null),
  fetchNftMetadata: jest.fn(),
  fetchPlaceByCreatorAddress: jest.fn(),
  getConnectedProvider: jest.fn(),
  getExplorerDeeplink: jest.fn().mockReturnValue('decentraland://open'),
  getSigninDeeplink: jest.fn().mockReturnValue('decentraland://open?signin=anIdentityId'),
  getMetaTransactionChainId: jest.fn().mockReturnValue(137),
  getNetworkProvider: jest.fn(),
  isSignatureMethod: (...args: any[]) => mockIsSignatureMethod(...args),
  extractSignaturePayload: (...args: any[]) => mockExtractSignaturePayload(...args),
  decodeMetaTransactionTypedData: (...args: any[]) => mockDecodeMetaTransactionTypedData(...args),
  buildSendTransactionSimulationPayload: (...args: any[]) => mockBuildSendTransactionSimulationPayload(...args)
}))

// Mock decentraland-transactions
jest.mock('decentraland-transactions', () => ({
  ContractName: { ERC721CollectionV2: 'ERC721CollectionV2', ERC20: 'ERC20' },
  getContract: jest.fn().mockReturnValue({ abi: [] }),
  sendMetaTransaction: jest.fn()
}))

// Mock decentraland-ui2
jest.mock('decentraland-ui2', () => ({
  Button: (props: any) => <button {...props} />,
  Dialog: (props: any) => (props.open ? <div data-testid="dialog">{props.children}</div> : null),
  DialogActions: (props: any) => <div>{props.children}</div>,
  DialogContent: (props: any) => <div>{props.children}</div>,
  DialogTitle: (props: any) => <div>{props.children}</div>
}))

jest.mock('@dcl/hooks', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const REQUEST_ID = 'test-request-123'
const CLIENT_LOGIN_REQUEST_PATH = '/auth/requests/client-login?targetConfigId=default'

let mockFlags: Partial<Record<string, boolean>>
let mockFlagsInitialized: boolean

const renderRequestPage = (path = `/auth/requests/${REQUEST_ID}?targetConfigId=default`) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
        <Routes>
          <Route path="/auth/requests/:requestId" element={<RequestPage />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </FeatureFlagsContext.Provider>
    </MemoryRouter>
  )
}

describe('RequestPage', () => {
  beforeEach(() => {
    mockSkipSetup = false
    mockFlags = {}
    mockFlagsInitialized = true
    mockTargetConfig = { skipSetup: false, explorerText: 'Explorer' }
    mockConnectionData = {
      isLoading: false,
      account: '0xabc123',
      provider: { isMagic: false },
      providerType: ProviderType.INJECTED,
      identity: { ephemeralIdentity: {}, expiration: new Date(), authChain: [] }
    }
    mockIsSignatureMethod.mockImplementation((method: string) =>
      ['personal_sign', 'eth_sign', 'eth_signtypeddata', 'eth_signtypeddata_v3', 'eth_signtypeddata_v4'].includes(method.toLowerCase())
    )
    mockExtractSignaturePayload.mockReturnValue({ kind: 'message', message: 'hello' })
    mockDecodeMetaTransactionTypedData.mockReturnValue(null)
    mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: false, contractName: null })
    mockBuildSendTransactionSimulationPayload.mockReturnValue({
      chainId: 137,
      from: '0xabc123',
      to: '0xcontract',
      data: '0x',
      value: '0'
    })
    mockSimulateTransaction.mockResolvedValue({ status: 'success', assetChanges: [], approvalChanges: [] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when the connection is still loading', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, isLoading: true }
    })

    it('should show the loading request view', () => {
      renderRequestPage()
      expect(screen.getByTestId('loading-request')).toBeInTheDocument()
    })
  })

  describe('when the user is not connected', () => {
    beforeEach(() => {
      mockConnectionData = {
        isLoading: false,
        account: null,
        provider: null,
        providerType: null,
        identity: null
      }
    })

    it('should navigate to the login page', async () => {
      renderRequestPage()
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login?redirectTo='))
      })
    })
  })

  describe('when feature flags are not yet initialized', () => {
    beforeEach(() => {
      mockFlagsInitialized = false
    })

    it('should show the loading request view while waiting', () => {
      renderRequestPage()
      expect(screen.getByTestId('loading-request')).toBeInTheDocument()
      expect(mockRecover).not.toHaveBeenCalled()
    })
  })

  describe('when the user is connected and flags are initialized', () => {
    describe('and the request recovery returns a dcl_personal_sign method', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockResolvedValue({
          sender: '0xabc123',
          expiration: new Date(Date.now() + 60000).toISOString(),
          method: 'dcl_personal_sign',
          code: '1234',
          params: ['Sign this message']
        })
      })

      it('should show the verify sign in view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('verify-sign-in')).toBeInTheDocument()
        })
      })
    })

    describe('and the request recovery returns an eth_sendTransaction method', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockGetBalance.mockResolvedValue(BigInt(1000000))
        mockGetChainId.mockResolvedValue(1)
        mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(100) })
        mockEstimateGas.mockResolvedValue(BigInt(21000))
        mockRecover.mockResolvedValue({
          sender: '0xabc123',
          expiration: new Date(Date.now() + 60000).toISOString(),
          method: 'eth_sendTransaction',
          params: [{ to: '0xcontract', data: '0x1234', value: '0' }]
        })
      })

      it('should show the wallet interaction view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('wallet-interaction')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with a DifferentSenderError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new DifferentSenderError('0xabc123', '0xother'))
      })

      it('should show the different account error view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('different-account')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with an ExpiredRequestError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new ExpiredRequestError(REQUEST_ID))
      })

      it('should show the timeout error view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('timeout-error')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with an IpValidationError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new IpValidationError(REQUEST_ID, 'IP mismatch'))
      })

      it('should show the IP validation error view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('ip-validation-error')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with a RequestFulfilledError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new RequestFulfilledError(REQUEST_ID))
      })

      it('should show sign-in complete view (request already consumed)', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockRecover).toHaveBeenCalled()
        })
        // Should show completion view — the request was already successfully consumed
        await waitFor(() => {
          expect(screen.getByTestId('sign-in-complete')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with an unexpected error', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new Error('Network failure'))
      })

      it('should show the recover error view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('recover-error')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with an ImpersonatedSignInError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new ImpersonatedSignInError('personal_sign'))
      })

      it('should show the signing error view instead of offering a retry', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('signing-error')).toBeInTheDocument()
        })
      })
    })

    describe('and the profile is incomplete (navigated to setup)', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue(null)
      })

      it('should not attempt to recover the request', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockEnsureProfile).toHaveBeenCalled()
        })
        expect(mockRecover).not.toHaveBeenCalled()
      })
    })

    describe('and targetConfig skips setup', () => {
      beforeEach(() => {
        mockSkipSetup = true
        mockTargetConfig = { skipSetup: true, explorerText: 'Explorer' }
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockRecover.mockResolvedValue({
          sender: '0xabc123',
          expiration: new Date(Date.now() + 60000).toISOString(),
          method: 'dcl_personal_sign',
          code: '5678',
          params: ['Sign this']
        })
      })

      it('should skip profile consistency check and show verify for returning user', async () => {
        // Returning user (has profile) → shows verification screen
        jest.mocked(fetchProfile).mockResolvedValue({ avatars: [{ name: 'TestUser' }] } as any)
        jest.mocked(isProfileComplete).mockReturnValue(true)

        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('verify-sign-in')).toBeInTheDocument()
        })
        expect(mockEnsureProfile).not.toHaveBeenCalled()
      })

      it('should auto-sign for new user and show success page', async () => {
        // New user (no profile) → auto-signs → shows success
        jest.mocked(fetchProfile).mockResolvedValue(null)
        jest.mocked(isProfileComplete).mockReturnValue(false)
        mockSignMessage.mockResolvedValue('0xsignature')
        mockSendSuccessfulOutcome.mockResolvedValue({})

        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('sign-in-complete-page')).toBeInTheDocument()
        })
        expect(mockEnsureProfile).not.toHaveBeenCalled()
      })

      it('should skip auto-sign and show confirmation page for new user in deep link flow', async () => {
        jest.mocked(fetchProfile).mockResolvedValue(null)
        jest.mocked(isProfileComplete).mockReturnValue(false)

        renderRequestPage(`/auth/requests/${REQUEST_ID}?targetConfigId=default&flow=deeplink`)
        await waitFor(() => {
          expect(screen.getByTestId('verify-sign-in')).toBeInTheDocument()
        })
        expect(mockSignMessage).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      })
    })

    describe('and the request id is the client-login pseudo request id', () => {
      beforeEach(() => {
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
      })

      describe('and the connected user has an identity', () => {
        beforeEach(() => {
          mockPostIdentity.mockResolvedValueOnce({ identityId: 'anIdentityId' })
        })

        it('should post the identity to the auth server and show the continue in app view', async () => {
          renderRequestPage(CLIENT_LOGIN_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(mockPostIdentity).toHaveBeenCalledWith(mockConnectionData.identity)
        })

        it('should not recover any request from the auth server', async () => {
          renderRequestPage(CLIENT_LOGIN_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(mockRecover).not.toHaveBeenCalled()
        })

        it('should build the signin deep link without the bridge-only flag', async () => {
          renderRequestPage(CLIENT_LOGIN_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(jest.mocked(getSigninDeeplink)).toHaveBeenCalledWith(undefined, 'anIdentityId', false)
        })
      })

      describe('and the bridge-only flag is enabled', () => {
        beforeEach(() => {
          jest.mocked(isBridgeOnlyEnabled).mockReturnValue(true)
          mockPostIdentity.mockResolvedValueOnce({ identityId: 'anIdentityId' })
        })

        afterEach(() => {
          jest.mocked(isBridgeOnlyEnabled).mockReturnValue(false)
        })

        it('should build the signin deep link with the bridge-only flag', async () => {
          renderRequestPage(CLIENT_LOGIN_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(jest.mocked(getSigninDeeplink)).toHaveBeenCalledWith(undefined, 'anIdentityId', true)
        })
      })

      describe('and the connected user has no identity', () => {
        beforeEach(() => {
          mockConnectionData = { ...mockConnectionData, identity: null }
        })

        it('should navigate to the login page without posting an identity', async () => {
          renderRequestPage(CLIENT_LOGIN_REQUEST_PATH)
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/login?redirectTo='))
          })
          expect(mockPostIdentity).not.toHaveBeenCalled()
        })
      })

      describe('and posting the identity fails', () => {
        beforeEach(() => {
          mockPostIdentity.mockRejectedValueOnce(new Error('Failed to create identity'))
        })

        it('should show the client login error view', async () => {
          renderRequestPage(CLIENT_LOGIN_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toBeInTheDocument()
          })
        })
      })
    })

    describe('and the wallet changes while profile consistency is loading', () => {
      let resolveProfile: (value: any) => void

      beforeEach(() => {
        // Make ensureProfile hang until we resolve it manually
        mockEnsureProfile.mockImplementation(
          () =>
            new Promise(resolve => {
              resolveProfile = resolve
            })
        )
        mockGetAddresses.mockResolvedValue(['0xnewwallet'])
        mockRecover.mockResolvedValue({
          sender: '0xnewwallet',
          expiration: new Date(Date.now() + 60000).toISOString(),
          method: 'dcl_personal_sign',
          code: '9999',
          params: ['Sign this']
        })
      })

      it('should cancel the stale request and not set state from the old wallet', async () => {
        const { rerender } = renderRequestPage()

        // Wait for the profile check to start
        await waitFor(() => {
          expect(mockEnsureProfile).toHaveBeenCalledWith('0xabc123', expect.anything(), expect.anything())
        })

        // Simulate wallet change: update the mock and re-render with new connection data
        mockConnectionData = {
          ...mockConnectionData,
          account: '0xnewwallet',
          provider: { isMagic: false, isNewProvider: true },
          providerType: ProviderType.INJECTED
        }

        rerender(
          <MemoryRouter initialEntries={[`/auth/requests/${REQUEST_ID}?targetConfigId=default`]}>
            <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
              <Routes>
                <Route path="/auth/requests/:requestId" element={<RequestPage />} />
              </Routes>
            </FeatureFlagsContext.Provider>
          </MemoryRouter>
        )

        // Now resolve the old profile check — it should be cancelled and not proceed to recover
        resolveProfile({ avatars: [{ name: 'OldUser' }] })

        // Wait for the new effect to start its own profile check for the new wallet
        await waitFor(() => {
          expect(mockEnsureProfile).toHaveBeenCalledWith('0xnewwallet', expect.anything(), expect.anything())
        })
      })
    })
  })

  describe('when approving a plain signature request', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'personal_sign',
        params: ['hello', '0xabc123'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should forward the request to the wallet without requiring a contract address', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      await waitFor(() => {
        expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: ['hello', '0xabc123'] })
      })
    })

    it('should complete the interaction after a successful signature', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
    })
  })

  describe('when a Thirdweb user approves a transaction', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.THIRDWEB }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: '0xcontract', data: '0xabcd', value: '0x0' }],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockGetBalance.mockResolvedValue(BigInt(1))
      mockGetChainId.mockResolvedValue(1)
      mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
      mockEstimateGas.mockResolvedValue(BigInt(1))
    })

    it('should open the confirmation dialog instead of sending immediately', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      expect(await screen.findByTestId('transaction-confirm-dialog')).toBeInTheDocument()
    })
  })

  describe('when a web2 transaction is relayed as a meta-transaction', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: '0xcontract', data: '0xabcd', value: '0x0' }],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockGetBalance.mockResolvedValue(BigInt(1))
      mockGetChainId.mockResolvedValue(1)
      mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
      mockEstimateGas.mockResolvedValue(BigInt(1))
    })

    it('should mark the confirmation dialog as gas-covered', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      const dialog = await screen.findByTestId('transaction-confirm-dialog')
      await waitFor(() => expect(dialog).toHaveAttribute('data-gas-covered', 'true'))
    })
  })

  describe('when a web2 user receives a signature request and simulation is enabled', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockFlags = { [FeatureFlagsKeys.TRANSACTION_SIMULATION]: true }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'personal_sign',
        params: ['hello', '0xabc123'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
    })

    it('should render the signature preview view', async () => {
      renderRequestPage()
      expect(await screen.findByTestId('signature-request')).toBeInTheDocument()
    })

    it('should not fall back to the generic wallet interaction view', async () => {
      renderRequestPage()
      await screen.findByTestId('signature-request')
      expect(screen.queryByTestId('wallet-interaction')).not.toBeInTheDocument()
    })
  })

  describe('when a web2 user receives a transaction and simulation is enabled', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockFlags = { [FeatureFlagsKeys.TRANSACTION_SIMULATION]: true }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: '0xcontract', data: '0xabcd', value: '0x0' }],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockGetBalance.mockResolvedValue(BigInt(1))
      mockGetChainId.mockResolvedValue(1)
      mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
      mockEstimateGas.mockResolvedValue(BigInt(1))
    })

    it('should prefetch the transaction simulation', async () => {
      renderRequestPage()
      await waitFor(() => expect(mockSimulateTransaction).toHaveBeenCalled())
    })

    describe('and the simulation request fails', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new Error('tenderly down'))
      })

      it('should still render the wallet interaction view (fail open)', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()
      })
    })
  })

  describe('when a web2 user receives a transaction and simulation is disabled', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockFlags = {}
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: '0xcontract', data: '0xabcd', value: '0x0' }],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockGetBalance.mockResolvedValue(BigInt(1))
      mockGetChainId.mockResolvedValue(1)
      mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
      mockEstimateGas.mockResolvedValue(BigInt(1))
    })

    it('should not call the simulation endpoint', async () => {
      renderRequestPage()
      await screen.findByTestId('wallet-interaction')
      expect(mockSimulateTransaction).not.toHaveBeenCalled()
    })
  })
})
