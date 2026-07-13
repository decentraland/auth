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
import { getAuthRequestId, isBridgeOnlyEnabled } from '../../../shared/locations'
import { isProfileComplete } from '../../../shared/profile'
import { trackEvent } from '../../../shared/utils/analytics'
import { TrackingEvents } from '../../../modules/analytics/types'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { RequestPage } from './RequestPage'
import { decodeManaTransferData, decodeNftTransferData, fetchNftMetadata, getSigninDeeplink } from './utils'

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
jest.mock('../../../shared/locations', () => {
  // Keep the pure `flow`/UUID parsers real (tests drive the flow through the URL) and only mock the
  // helpers a test needs to control.
  const actual = jest.requireActual('../../../shared/locations')
  return {
    ...actual,
    extractReferrerFromSearchParameters: jest.fn().mockReturnValue(null),
    isBridgeOnlyEnabled: jest.fn().mockReturnValue(false),
    getAuthRequestId: jest.fn().mockReturnValue(null),
    buildRequestPageUrl: (requestId: string, targetConfigId: string) => `/auth/requests/${requestId}?targetConfigId=${targetConfigId}`
  }
})
jest.mock('../../../shared/utils/analytics', () => ({
  identifyUser: jest.fn(),
  trackEvent: jest.fn()
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
  VerifySignIn: (props: any) => (
    <div data-testid="verify-sign-in">
      Verify Sign In - Code: {props.code}
      <button data-testid="verify-sign-in-approve" onClick={props.onApprove}>
        approve
      </button>
      <button data-testid="verify-sign-in-deny" onClick={props.onDeny}>
        deny
      </button>
    </div>
  ),
  DeniedSignIn: () => <div data-testid="denied-sign-in">Denied</div>,
  SignInComplete: () => <div data-testid="sign-in-complete">Complete</div>,
  SignInCompletePage: () => <div data-testid="sign-in-complete-page">Login Successful!</div>,
  TimeoutError: () => <div data-testid="timeout-error">Timeout</div>,
  DifferentAccountError: () => <div data-testid="different-account">Different Account</div>,
  IpValidationError: (props: any) => <div data-testid="ip-validation-error">IP Error: {props.reason}</div>,
  RecoverError: () => <div data-testid="recover-error">Recover Error</div>,
  SigningError: (props: any) => <div data-testid="signing-error">Signing Error: {props.error}</div>,
  WalletInteraction: (props: any) => (
    <div
      data-testid="wallet-interaction"
      data-sim={props.simulation?.status}
      data-requires-acknowledgment={String(props.requiresAcknowledgment)}
      data-gas-covered={String(props.gasCovered)}
    >
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
      data-requires-acknowledgment={String(props.requiresAcknowledgment)}
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
const mockIsKnownDecentralandContract = jest.fn()
const mockIsDecentralandContractAddress = jest.fn()
const mockIsApprovalGrantingTypedData = jest.fn()
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
  isKnownDecentralandContract: (...args: any[]) => mockIsKnownDecentralandContract(...args),
  isDecentralandContractAddress: (...args: any[]) => mockIsDecentralandContractAddress(...args),
  isApprovalGrantingTypedData: (...args: any[]) => mockIsApprovalGrantingTypedData(...args),
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
// The deep-link handoff requires a valid UUID v4 route id (the client's correlation id).
const DEEP_LINK_REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'
const DEEP_LINK_REQUEST_PATH = `/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default&flow=deeplink`

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
    mockIsKnownDecentralandContract.mockReturnValue(false)
    mockIsDecentralandContractAddress.mockResolvedValue(false)
    mockIsApprovalGrantingTypedData.mockReturnValue(false)
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
    mockSimulateTransaction.mockResolvedValue({ status: 'success', assetChanges: [], approvalChanges: [], balanceChanges: [], events: [] })
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

      it('should fall through to the verify screen for a new user when the auto-sign message is malformed', async () => {
        // New user (no profile) but the request carries a non-string message: instead of dead-ending
        // on the loading spinner, the flow falls through to the normal verification screen.
        jest.mocked(fetchProfile).mockResolvedValue(null)
        jest.mocked(isProfileComplete).mockReturnValue(false)
        mockRecover.mockResolvedValue({
          sender: '0xabc123',
          expiration: new Date(Date.now() + 60000).toISOString(),
          method: 'dcl_personal_sign',
          code: '5678',
          params: [{ not: 'a string' }]
        })

        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('verify-sign-in')).toBeInTheDocument()
        })
        expect(mockSignMessage).not.toHaveBeenCalled()
      })
    })

    describe('and the flow is a deep-link handoff (flow=deeplink with a UUID v4 id)', () => {
      beforeEach(() => {
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
      })

      describe('and the connected user has an identity', () => {
        beforeEach(() => {
          mockPostIdentity.mockResolvedValueOnce({ identityId: 'anIdentityId' })
        })

        it('should post the identity to the auth server (forwarding the route UUID) and show the continue in app view', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(mockPostIdentity).toHaveBeenCalledWith(mockConnectionData.identity, { authRequestId: DEEP_LINK_REQUEST_ID })
        })

        it('should not recover any request from the auth server', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(mockRecover).not.toHaveBeenCalled()
        })

        it('should forward the route UUID to the client as the signin deep link authRequestId', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(jest.mocked(getSigninDeeplink)).toHaveBeenCalledWith(undefined, 'anIdentityId', false, DEEP_LINK_REQUEST_ID)
        })

        it('should accept the flow value case-insensitively', async () => {
          renderRequestPage(`/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default&flow=DeepLink`)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(mockPostIdentity).toHaveBeenCalled()
        })
      })

      describe('and the bridgeOnly flag is enabled', () => {
        beforeEach(() => {
          jest.mocked(isBridgeOnlyEnabled).mockReturnValue(true)
          mockPostIdentity.mockResolvedValueOnce({ identityId: 'anIdentityId' })
        })

        afterEach(() => {
          jest.mocked(isBridgeOnlyEnabled).mockReturnValue(false)
        })

        it('should build the signin deep link with the bridgeOnly flag', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(jest.mocked(getSigninDeeplink)).toHaveBeenCalledWith(undefined, 'anIdentityId', true, DEEP_LINK_REQUEST_ID)
        })
      })

      describe('and a query authRequestId is also present', () => {
        beforeEach(() => {
          jest.mocked(getAuthRequestId).mockReturnValue('auth-req-abc')
          mockPostIdentity.mockResolvedValueOnce({ identityId: 'anIdentityId' })
        })

        afterEach(() => {
          jest.mocked(getAuthRequestId).mockReturnValue(null)
        })

        it('should forward the route UUID as the authRequestId, not the query value', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('continue-in-app')).toBeInTheDocument()
          })
          expect(jest.mocked(getSigninDeeplink)).toHaveBeenCalledWith(undefined, 'anIdentityId', false, DEEP_LINK_REQUEST_ID)
        })
      })

      describe('and the connected user has no identity', () => {
        beforeEach(() => {
          mockConnectionData = { ...mockConnectionData, identity: null }
        })

        it('should navigate to the login page without posting an identity', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
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
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toBeInTheDocument()
          })
        })

        it('should track the failure with the route UUID and a post_identity_failed reason', async () => {
          renderRequestPage(DEEP_LINK_REQUEST_PATH)
          await waitFor(() => {
            expect(jest.mocked(trackEvent)).toHaveBeenCalledWith(TrackingEvents.DEEP_LINK_AUTH_FAILED, {
              authRequestId: DEEP_LINK_REQUEST_ID,
              reason: 'post_identity_failed'
            })
          })
        })
      })

      describe('and the route id is not a valid UUID v4', () => {
        it('should show the error view without posting an identity or recovering a request', async () => {
          renderRequestPage('/auth/requests/not-a-uuid?targetConfigId=default&flow=deeplink')
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toBeInTheDocument()
          })
          expect(mockPostIdentity).not.toHaveBeenCalled()
          expect(mockRecover).not.toHaveBeenCalled()
        })

        it('should not run the profile consistency check', async () => {
          renderRequestPage('/auth/requests/not-a-uuid?targetConfigId=default&flow=deeplink')
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toBeInTheDocument()
          })
          expect(mockEnsureProfile).not.toHaveBeenCalled()
        })

        it('should explain that the sign-in link is invalid', async () => {
          renderRequestPage('/auth/requests/not-a-uuid?targetConfigId=default&flow=deeplink')
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toHaveTextContent('The sign-in link is invalid.')
          })
        })

        it('should track the failure with an invalid_request_id reason', async () => {
          renderRequestPage('/auth/requests/not-a-uuid?targetConfigId=default&flow=deeplink')
          await waitFor(() => {
            expect(jest.mocked(trackEvent)).toHaveBeenCalledWith(TrackingEvents.DEEP_LINK_AUTH_FAILED, {
              authRequestId: 'not-a-uuid',
              reason: 'invalid_request_id'
            })
          })
        })
      })
    })

    describe('and the request id is a UUID v4 but the flow param is absent', () => {
      // The handoff is gated on flow=deeplink, not on the id shape: a UUID alone must NOT trigger
      // the identity post — it goes through the normal recover flow like any other request.
      beforeEach(() => {
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockRecover.mockResolvedValue({
          sender: '0xabc123',
          expiration: new Date(Date.now() + 60000).toISOString(),
          method: 'dcl_personal_sign',
          code: '1234',
          params: ['Sign this message']
        })
      })

      it('should recover the request normally and not post an identity', async () => {
        renderRequestPage(`/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default`)
        await waitFor(() => {
          expect(screen.getByTestId('verify-sign-in')).toBeInTheDocument()
        })
        expect(mockRecover).toHaveBeenCalledWith(DEEP_LINK_REQUEST_ID, '0xabc123')
        expect(mockPostIdentity).not.toHaveBeenCalled()
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

  describe('when approving a sign-in verification (dcl_personal_sign)', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
      mockRecover.mockResolvedValue({
        method: 'dcl_personal_sign',
        code: '1234',
        params: ['Sign this message'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockSignMessage.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should sign the message and send the signature as the outcome', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('verify-sign-in-approve'))
      await waitFor(() => {
        expect(mockSendSuccessfulOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', '0xsignature')
      })
      expect(await screen.findByTestId('sign-in-complete')).toBeInTheDocument()
    })

    it('should not post the identity (that mechanism is only for the deep-link handoff)', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('verify-sign-in-approve'))
      await waitFor(() => expect(mockSendSuccessfulOutcome).toHaveBeenCalled())
      expect(mockPostIdentity).not.toHaveBeenCalled()
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

    it('should show the informative simulation-based confirmation instead of sending immediately', async () => {
      // Simulation is always on for web2 wallets, so the transaction is previewed in the
      // informative wallet-interaction view (single-step approval) rather than the classic
      // no-summary confirm dialog.
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(mockSimulateTransaction).toHaveBeenCalled())
      expect(view).toBeInTheDocument()
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

    it('should mark the wallet interaction as gas-covered', async () => {
      // With always-on simulation the gas-covered signal is shown inline in the informative
      // wallet-interaction view rather than in the classic confirm dialog.
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-gas-covered', 'true'))
    })
  })

  describe('when a web2 transaction is a MANA tip (donation)', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      jest.mocked(decodeManaTransferData).mockReturnValueOnce({ manaAmount: '10', toAddress: '0xrecipient' })
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: '0xmanacontract', data: '0xa9059cbb', value: '0x0' }],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockGetBalance.mockResolvedValue(BigInt(1))
      mockGetChainId.mockResolvedValue(137)
    })

    it('should show the donation transfer view and NOT run a simulation', async () => {
      renderRequestPage()
      expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
      expect(mockSimulateTransaction).not.toHaveBeenCalled()
    })
  })

  describe('when a web2 user receives a signature request (simulation always on for web2)', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
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

  describe('when a web2 user receives an off-chain approval signature (permit/order)', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_signTypedData_v4',
        params: ['0xabc123', '{"primaryType":"Permit"}'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockExtractSignaturePayload.mockReturnValue({ kind: 'typedData', typedData: { primaryType: 'Permit' }, raw: '{}' })
      mockDecodeMetaTransactionTypedData.mockReturnValue(null)
      mockIsApprovalGrantingTypedData.mockReturnValue(true)
    })

    it('should require an explicit acknowledgment before signing', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
    })
  })

  describe('when a web2 user receives a MetaTransaction signature and the simulation is unavailable', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_signTypedData_v4',
        params: ['0xabc123', '{"primaryType":"MetaTransaction"}'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockExtractSignaturePayload.mockReturnValue({ kind: 'typedData', typedData: { primaryType: 'MetaTransaction' }, raw: '{}' })
      mockDecodeMetaTransactionTypedData.mockReturnValue({
        from: '0xabc123',
        verifyingContract: '0xVerifyingContract',
        functionSignature: '0xdeadbeef',
        chainId: 137
      })
      mockSimulateTransaction.mockRejectedValue(new Error('tenderly down'))
    })

    it('should require acknowledgment when the verifying contract is NOT a Decentraland contract', async () => {
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: false, contractName: null })
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
    })

    it('should NOT require acknowledgment once the verifying contract is verified as a Decentraland contract', async () => {
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
      await waitFor(() => expect(view).toHaveAttribute('data-requires-acknowledgment', 'false'))
    })
  })

  describe('when a web2 user receives an NFT transfer', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: '0xcollection', data: '0x23b872dd', value: '0x0' }],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockGetBalance.mockResolvedValue(BigInt(1))
      mockGetChainId.mockResolvedValue(1)
      mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
      mockEstimateGas.mockResolvedValue(BigInt(1))
      jest.mocked(decodeNftTransferData).mockReturnValue({ tokenId: '1', toAddress: '0xrecipient' })
      jest.mocked(fetchProfile).mockResolvedValue(null)
    })

    describe('and the target is a verified Decentraland collection', () => {
      beforeEach(() => {
        mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
        jest
          .mocked(fetchNftMetadata)
          .mockResolvedValue({ imageUrl: 'x', tokenId: '1', name: 'n', description: 'd', rarity: 'common' } as any)
      })

      it('should show the branded gift confirmation view', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
      })
    })

    describe('and the target is not a Decentraland collection', () => {
      beforeEach(() => {
        mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: false, contractName: null })
      })

      it('should fall through to the generic wallet interaction view instead of the branded gift view', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })
    })
  })

  describe('when a web2 user receives a transaction (simulation always on for web2)', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
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

    it('should reuse the prefetched meta-transaction check on approve instead of re-checking', async () => {
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      renderRequestPage()
      await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(mockCheckMetaTransactionSupport).toHaveBeenCalled())
      const callsAfterPrefetch = mockCheckMetaTransactionSupport.mock.calls.length

      await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
      await screen.findByTestId('wallet-interaction-complete')

      expect(mockCheckMetaTransactionSupport.mock.calls.length).toBe(callsAfterPrefetch)
    })

    describe('and the simulation request fails', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new Error('tenderly down'))
      })

      it('should still render the wallet interaction view (fail open)', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()
      })

      it('should require an explicit acknowledgment instead of a single-click approve for an unpreviewable non-Decentraland transaction', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })
  })

  describe('when an external (web3) wallet receives a transaction', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
      // A generic transaction (not a decoded MANA/NFT transfer) so it takes the WALLET_INTERACTION
      // path. Reset the decoders explicitly — a prior test sets a persistent NFT return value.
      jest.mocked(decodeManaTransferData).mockReturnValue(null)
      jest.mocked(decodeNftTransferData).mockReturnValue(null)
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

    it('should not call the simulation endpoint (external wallets keep their own confirmation UI)', async () => {
      renderRequestPage()
      await screen.findByTestId('wallet-interaction')
      expect(mockSimulateTransaction).not.toHaveBeenCalled()
    })
  })
})
