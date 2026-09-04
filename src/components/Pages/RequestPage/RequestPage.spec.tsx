/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import { useLayoutEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderType } from '@dcl/schemas'
import { TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import {
  DifferentSenderError,
  ExpiredRequestError,
  ImpersonatedSignInError,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
  RequestFulfilledError,
  SimulationUnavailableError,
  UnsupportedMethodError
} from '../../../shared/auth'
import { extractReferrerFromSearchParameters, getAuthRequestId, isBridgeOnlyEnabled } from '../../../shared/locations'
import { trackEvent } from '../../../shared/utils/analytics'
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
    getAuthRequestId: jest.fn().mockReturnValue(null)
    // buildRequestPageUrl is intentionally left real so referrer/param preservation is exercised end-to-end
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
  TimeoutError: () => <div data-testid="timeout-error">Timeout</div>,
  DifferentAccountError: () => <div data-testid="different-account">Different Account</div>,
  OutdatedClientError: () => <div data-testid="outdated-client-error">Outdated Client</div>,
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
      data-contract-trust={props.contractTrust}
      data-unverifiable={props.unverifiableReason ?? ''}
    >
      <button data-testid="signature-approve" onClick={props.onApprove}>
        approve
      </button>
      <button data-testid="signature-deny" onClick={props.onDeny}>
        deny
      </button>
    </div>
  )
}))

// --- Utils ---
const mockIsSignatureMethod = jest.fn()
const mockExtractSignaturePayload = jest.fn()
const mockDecodeMetaTransactionTypedData = jest.fn()
const mockBuildSendTransactionSimulationPayload = jest.fn()
const mockIsOpaqueSignatureMessage = jest.fn()
const mockCheckMetaTransactionSupport = jest.fn()
const mockIsKnownDecentralandContractOnChain = jest.fn()
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
  isKnownDecentralandContractOnChain: (...args: any[]) => mockIsKnownDecentralandContractOnChain(...args),
  isDecentralandContractAddress: (...args: any[]) => mockIsDecentralandContractAddress(...args),
  isApprovalGrantingTypedData: (...args: any[]) => mockIsApprovalGrantingTypedData(...args),
  extractSignaturePayload: (...args: any[]) => mockExtractSignaturePayload(...args),
  decodeMetaTransactionTypedData: (...args: any[]) => mockDecodeMetaTransactionTypedData(...args),
  isOpaqueSignatureMessage: (...args: any[]) => mockIsOpaqueSignatureMessage(...args),
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
    mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
    mockIsDecentralandContractAddress.mockResolvedValue(false)
    mockIsApprovalGrantingTypedData.mockReturnValue(false)
    mockIsOpaqueSignatureMessage.mockReturnValue(false)
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

    describe('and the request URL carries a referrer', () => {
      const REFERRER = '0x24e5f44999c151f08609f8e27b2238c773c4d020'

      beforeEach(() => {
        ;(extractReferrerFromSearchParameters as jest.Mock).mockReturnValue(REFERRER)
      })

      afterEach(() => {
        ;(extractReferrerFromSearchParameters as jest.Mock).mockReturnValue(null)
      })

      it('should preserve the referrer inside the login redirectTo so it survives the round-trip', async () => {
        renderRequestPage(`/auth/requests/${REQUEST_ID}?targetConfigId=default&referrer=${REFERRER}`)
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(`referrer%3D${REFERRER}`))
        })
      })

      it('should also pass the referrer as a top-level /login param so the login page can hand it to setup', async () => {
        // LoginPage reads the referrer from its OWN url (not from inside redirectTo) when
        // routing a new user to profile setup — without the top-level param the referral
        // POST never fires for a not-yet-connected wallet user.
        renderRequestPage(`/auth/requests/${REQUEST_ID}?targetConfigId=default&referrer=${REFERRER}`)
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(`&referrer=${REFERRER}`))
        })
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
    describe('and recovery fails with an UnsupportedMethodError (the retired dcl_personal_sign sign-in)', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new UnsupportedMethodError('dcl_personal_sign'))
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should tell the user to update instead of offering a retry that cannot succeed', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('outdated-client-error')).toBeInTheDocument()
        })
        expect(screen.queryByTestId('recover-error')).not.toBeInTheDocument()
        expect(mockSignMessage).not.toHaveBeenCalled()
      })

      it('should report a method-not-supported outcome so the un-migrated client is answered instead of left waiting', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', {
            code: -32601,
            message: 'The "dcl_personal_sign" method is not supported'
          })
        })
      })
    })

    describe('and recovery fails with an UnsupportedMethodError for any other method', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new UnsupportedMethodError('eth_sign'))
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the generic recover error view, not the outdated client one', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('recover-error')).toBeInTheDocument()
        })
        expect(screen.queryByTestId('outdated-client-error')).not.toBeInTheDocument()
      })

      it('should report a method-not-supported outcome carrying the rejected method', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', {
            code: -32601,
            message: 'The "eth_sign" method is not supported'
          })
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
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the different account error view', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('different-account')).toBeInTheDocument()
        })
      })

      it('should leave the request pending rather than answering one addressed to another account', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('different-account')).toBeInTheDocument()
        })
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
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

    describe('and recovery fails with a RequestFulfilledError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new RequestFulfilledError(REQUEST_ID))
      })

      it('should show the interaction complete view (request already consumed)', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockRecover).toHaveBeenCalled()
        })
        // Should show completion view — the request was already successfully consumed
        await waitFor(() => {
          expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
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
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the signing error view instead of offering a retry', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('signing-error')).toBeInTheDocument()
        })
      })

      it('should report an invalid-params outcome instead of leaving the blocked sign-in attempt unanswered', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', {
            code: -32602,
            message: 'The "personal_sign" method cannot be used to sign a Decentraland sign-in payload'
          })
        })
      })
    })

    describe('and recovery fails with a MalformedTransactionRequestError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new MalformedTransactionRequestError('eth_sendTransaction', '"to" must be an address'))
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the signing error view instead of offering a retry', async () => {
        renderRequestPage()
        await waitFor(() => expect(screen.getByTestId('signing-error')).toBeInTheDocument())
      })

      it('should report an invalid-params outcome naming the broken rule', async () => {
        renderRequestPage()
        await waitFor(() =>
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', {
            code: -32602,
            message: 'The "eth_sendTransaction" transaction parameters are malformed: "to" must be an address'
          })
        )
      })
    })

    describe('and recovery fails with a MalformedSignatureRequestError', () => {
      beforeEach(() => {
        mockGetAddresses.mockResolvedValue(['0xabc123'])
        mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
        mockRecover.mockRejectedValue(new MalformedSignatureRequestError('eth_signTypedData_v4'))
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the signing error view instead of offering a retry', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(screen.getByTestId('signing-error')).toBeInTheDocument()
        })
        expect(screen.queryByTestId('recover-error')).not.toBeInTheDocument()
      })

      it('should report an invalid-params outcome so the client is answered immediately', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', {
            code: -32602,
            message: 'The "eth_signTypedData_v4" request parameters are malformed'
          })
        })
      })

      describe('and reporting the rejection to the auth server fails', () => {
        let consoleErrorSpy: jest.SpyInstance

        beforeEach(() => {
          consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
          mockSendFailedOutcome.mockRejectedValue(new Error('Auth server unreachable'))
        })

        afterEach(() => {
          consoleErrorSpy.mockRestore()
        })

        it('should still show the signing error view, since the report is best-effort', async () => {
          renderRequestPage()
          await waitFor(() => {
            expect(screen.getByTestId('signing-error')).toBeInTheDocument()
          })
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
          method: 'personal_sign',
          params: ['hello', '0xabc123']
        })
      })

      it('should skip the profile consistency check', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockRecover).toHaveBeenCalled()
        })
        expect(mockEnsureProfile).not.toHaveBeenCalled()
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
          method: 'personal_sign',
          params: ['hello', '0xabc123']
        })
      })

      it('should recover the request normally and not post an identity', async () => {
        renderRequestPage(`/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default`)
        await waitFor(() => {
          expect(mockRecover).toHaveBeenCalledWith(DEEP_LINK_REQUEST_ID, '0xabc123')
        })
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
          method: 'personal_sign',
          params: ['Sign this', '0xnewwallet']
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

  describe('when the wallet switches account after the request was recovered', () => {
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
    })

    it('should drop the previous review and show the loading view until the new account has recovered the request', async () => {
      const { rerender } = renderRequestPage()
      expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()

      // The new account's own recovery is held so the state in between is observable.
      mockRecover.mockImplementationOnce(() => new Promise(() => undefined))
      mockGetAddresses.mockResolvedValue(['0xnewwallet'])
      mockConnectionData = { ...mockConnectionData, account: '0xnewwallet' }
      rerender(
        <MemoryRouter initialEntries={[`/auth/requests/${REQUEST_ID}?targetConfigId=default`]}>
          <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
            <Routes>
              <Route path="/auth/requests/:requestId" element={<RequestPage />} />
            </Routes>
          </FeatureFlagsContext.Provider>
        </MemoryRouter>
      )

      expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
      expect(screen.queryByTestId('wallet-interaction-approve')).not.toBeInTheDocument()
    })
  })

  describe('when the wallet reports a different active account at approval time than the one that reviewed the request', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'personal_sign',
        params: ['hello', '0xabc123'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      // The request is recovered by the reviewing account; by the time Allow is clicked the wallet has
      // moved on to another one.
      mockGetAddresses.mockResolvedValueOnce(['0xabc123']).mockResolvedValue(['0xnewwallet'])
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should not forward the request to the wallet', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    it('should not report an outcome for it', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the different-account view instead of leaving an Allow button that does nothing', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      expect(await screen.findByTestId('different-account')).toBeInTheDocument()
    })
  })

  describe('when the wallet reports a different active account at denial time than the one that reviewed the request', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'personal_sign',
        params: ['hello', '0xabc123'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValueOnce(['0xabc123']).mockResolvedValue(['0xnewwallet'])
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should not report a rejection from an account that never reviewed the request', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-deny'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the different-account view', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-deny'))
      expect(await screen.findByTestId('different-account')).toBeInTheDocument()
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

  describe('when the wallet executed the request but delivering its outcome fails', () => {
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
      mockSendSuccessfulOutcome.mockRejectedValue(new Error('Network error'))
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should not report a failed outcome for an action the wallet already performed', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      await waitFor(() => {
        expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
      })
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the completion view instead of an error that would invite a second signature', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
      expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
    })

    describe('and the failure is an expected already-fulfilled race', () => {
      beforeEach(() => {
        mockSendSuccessfulOutcome.mockRejectedValue(new RequestFulfilledError(REQUEST_ID))
      })

      it('should show the completion view without reporting a failed outcome', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
        await waitFor(() => {
          expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
        })
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      })
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

    describe('and the request carries fee, gas and other non-reviewed fields', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue({
          method: 'eth_sendTransaction',
          params: [
            {
              from: '0xattacker',
              to: '0xcontract',
              data: '0x',
              value: '0x0',
              gas: '0x5208',
              maxFeePerGas: '0x26f2c8b1a76',
              maxPriorityFeePerGas: '0x26f2c8b1a76',
              nonce: '0x1',
              type: '0x2'
            }
          ],
          sender: '0xabc123',
          expiration: new Date(Date.now() + 3600000).toISOString()
        })
        mockWalletRequest.mockResolvedValue('0xhash')
        mockSendSuccessfulOutcome.mockResolvedValue({})
      })

      it('should dispatch only the reviewed to, data and value to the wallet', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('wallet-interaction-approve'))
        await screen.findByTestId('wallet-interaction-complete')

        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_sendTransaction',
          params: [{ to: '0xcontract', data: '0x', value: '0x0', from: '0xabc123' }]
        })
      })
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

    describe('and the simulation is unavailable', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new SimulationUnavailableError('status 502', 502))
      })

      it('should require an acknowledgment because a gas-covered relay still executes the unpreviewable call', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
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

    it('should not require acknowledgment for readable text', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
    })
  })

  describe('when a web2 user receives a personal_sign message that is not readable text', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'personal_sign',
        params: [`0x${'ab'.repeat(32)}`, '0xabc123'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockExtractSignaturePayload.mockReturnValue({ kind: 'message', message: `0x${'ab'.repeat(32)}` })
      mockIsOpaqueSignatureMessage.mockReturnValue(true)
    })

    it('should require an acknowledgment because the user cannot check what is being signed', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
    })

    it('should tell the view the message is opaque', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-unverifiable', 'opaque_message')
    })
  })

  describe('when a web2 user receives a typed-data signature Auth does not recognize', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        method: 'eth_signTypedData_v4',
        params: ['0xabc123', '{"primaryType":"Statement"}'],
        sender: '0xabc123',
        expiration: new Date(Date.now() + 3600000).toISOString()
      })
      mockGetAddresses.mockResolvedValue(['0xabc123'])
      mockExtractSignaturePayload.mockReturnValue({ kind: 'typedData', typedData: { primaryType: 'Statement' }, raw: '{}' })
      mockDecodeMetaTransactionTypedData.mockReturnValue(null)
      mockIsApprovalGrantingTypedData.mockReturnValue(false)
    })

    it('should require an acknowledgment instead of a single click', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
    })

    it('should tell the view the struct is unrecognized', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-unverifiable', 'unrecognized_typed_data')
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

    it('should not treat a known approval type as unrecognized', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-unverifiable', '')
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
        calldataField: 'functionSignature',
        calldata: '0xdeadbeef',
        from: '0xabc123',
        verifyingContract: '0xVerifyingContract',
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

    it('should still require acknowledgment when the verifying contract is a Decentraland contract, because the signature leaves Auth as a bearer authorization', async () => {
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
    })

    describe('and the server was unavailable rather than rejecting the call', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new SimulationUnavailableError('status 502', 502))
      })

      it('should degrade to the unavailable preview with an acknowledgment instead of rejecting the request', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })
  })

  describe('when a web2 user receives a MetaTransaction signature and the server rejects the call itself', () => {
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
        calldataField: 'functionData',
        calldata: '0xdeadbeef',
        from: '0xabc123',
        verifyingContract: '0xVerifyingContract',
        chainId: 137
      })
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
      mockSimulateTransaction.mockRejectedValue(new SimulationUnavailableError('status 400', 400))
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should show the signing error view instead of an unpreviewable signature', async () => {
      renderRequestPage()
      await waitFor(() => expect(screen.getByTestId('signing-error')).toBeInTheDocument())
    })

    it('should report an invalid-params outcome naming the unpreviewable call', async () => {
      renderRequestPage()
      await waitFor(() =>
        expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', {
          code: -32602,
          message: 'The "eth_signTypedData_v4" request parameters are malformed: the MetaTransaction call cannot be previewed'
        })
      )
    })
  })

  describe('when a web2 user denies a MetaTransaction signature while its preview is still loading', () => {
    let rejectSimulation: (error: unknown) => void

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
        calldataField: 'functionData',
        calldata: '0xdeadbeef',
        from: '0xabc123',
        verifyingContract: '0xVerifyingContract',
        chainId: 137
      })
      mockSimulateTransaction.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectSimulation = reject
          })
      )
      mockSendFailedOutcome.mockResolvedValue({})
    })

    describe('and the server then rejects the call', () => {
      it('should keep the denied view and report only the user rejection', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('signature-deny'))
        await screen.findByTestId('denied-wallet-interaction')
        rejectSimulation(new SimulationUnavailableError('status 400', 400))
        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('denied-wallet-interaction')).toBeInTheDocument()
        expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, '0xabc123', { code: -32003, message: 'Transaction rejected' })
      })
    })
  })

  describe('when a web2 user receives a MetaTransaction signature with a successful preview', () => {
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
        calldataField: 'functionData',
        calldata: '0xdeadbeef',
        from: '0xattacker',
        verifyingContract: '0xVerifyingContract',
        chainId: 137
      })
      mockSimulateTransaction.mockResolvedValue({
        status: 'success',
        assetChanges: [],
        approvalChanges: [],
        balanceChanges: [],
        events: []
      })
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
    })

    it('should look up whether the verifying contract is a recognized Decentraland contract', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-contract-trust', 'confirmed'))
      expect(mockCheckMetaTransactionSupport).toHaveBeenCalledWith('0xVerifyingContract')
    })

    it('should preview the contract calling itself with the connected signer appended, not the from carried in the typed data', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      expect(mockSimulateTransaction).toHaveBeenCalledWith({
        chainId: 137,
        from: '0xVerifyingContract',
        to: '0xVerifyingContract',
        data: '0xdeadbeefabc123',
        value: '0'
      })
    })

    it('should not require acknowledgment when the preview succeeds without dangerous changes and the contract is recognized', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await waitFor(() => expect(view).toHaveAttribute('data-contract-trust', 'confirmed'))
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
    })

    describe('and the verifying contract is not a recognized Decentraland contract', () => {
      beforeEach(() => {
        mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: false, contractName: null })
      })

      it('should require acknowledgment even for a clean preview, because Auth cannot vouch for how the contract executes it', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await waitFor(() => expect(view).toHaveAttribute('data-contract-trust', 'unconfirmed'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the contract lookup fails', () => {
      beforeEach(() => {
        mockCheckMetaTransactionSupport.mockRejectedValue(new Error('meta-transaction server down'))
      })

      it('should treat the contract as unrecognized rather than skipping the acknowledgment', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-contract-trust', 'unconfirmed'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the typed data is bound to a different chain than the meta-transaction chain', () => {
      beforeEach(() => {
        mockDecodeMetaTransactionTypedData.mockReturnValue({
          calldataField: 'functionData',
          calldata: '0xdeadbeef',
          from: '0xabc123',
          verifyingContract: '0xVerifyingContract',
          chainId: 1
        })
      })

      it('should treat the contract as unrecognized because recognition is per deployment', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-contract-trust', 'unconfirmed'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })

      it('should not look the address up on the meta-transaction chain', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-contract-trust', 'unconfirmed'))
        expect(mockCheckMetaTransactionSupport).not.toHaveBeenCalled()
      })
    })
  })

  describe('when a web2 user receives a MetaTransaction signature whose inner call reverts', () => {
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
        calldataField: 'functionData',
        calldata: '0xdeadbeef',
        from: '0xabc123',
        verifyingContract: '0xVerifyingContract',
        chainId: 137
      })
      mockCheckMetaTransactionSupport.mockResolvedValue({ willUseMetaTransaction: true, contractName: 'ERC721CollectionV2' })
      mockSimulateTransaction.mockResolvedValue({
        status: 'reverted',
        error: 'Trade not effective yet',
        assetChanges: [],
        approvalChanges: [],
        balanceChanges: [],
        events: []
      })
    })

    it('should require acknowledgment even for a Decentraland contract, because the call can be relayed once it stops reverting', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
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

    describe('and the simulation grants an approval', () => {
      const approval = {
        kind: 'approval',
        standard: 'erc20',
        owner: '0xabc123',
        spender: '0xspender',
        amount: '100',
        rawAmount: '100000000000000000000',
        isUnlimited: false,
        tokenId: null,
        approved: null,
        contractAddress: '0xmana',
        symbol: 'MANA',
        name: 'MANA'
      }
      const simulationWith = (approvalChanges: unknown[]) => ({
        status: 'success',
        assetChanges: [],
        approvalChanges,
        balanceChanges: [],
        events: []
      })

      describe('and it is a limited allowance to a spender that is not a recognized Decentraland contract', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
          mockSimulateTransaction.mockResolvedValue(simulationWith([approval]))
        })

        it('should require an acknowledgment because a limited allowance hands the asset over just as surely', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
        })
      })

      describe('and it is a limited allowance to a recognized Decentraland contract', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(true)
          mockSimulateTransaction.mockResolvedValue(simulationWith([approval]))
        })

        it('should not require an acknowledgment because such approvals are routine', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
        })

        it('should recognize the spender on the chain the simulation ran on, not on any chain', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          // The mocked simulation payload names chain 137, so recognition must be asked for 137.
          expect(mockIsKnownDecentralandContractOnChain).toHaveBeenCalledWith('0xspender', 137)
        })
      })

      describe('and it is a single token approved to a spender that is not a recognized Decentraland contract', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
          mockSimulateTransaction.mockResolvedValue(
            simulationWith([{ ...approval, standard: 'erc721', amount: null, rawAmount: null, tokenId: '7' }])
          )
        })

        it('should require an acknowledgment', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
        })
      })

      describe('and it is a tiny allowance whose display amount rounds to zero, to an unrecognized spender', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
          mockSimulateTransaction.mockResolvedValue(simulationWith([{ ...approval, amount: '0', rawAmount: '1' }]))
        })

        it('should still require an acknowledgment because the base units say it is a grant', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
        })
      })

      describe('and it clears a single-token approval with the zero address', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
          mockSimulateTransaction.mockResolvedValue(
            simulationWith([
              {
                ...approval,
                standard: 'erc721',
                spender: '0x0000000000000000000000000000000000000000',
                amount: null,
                rawAmount: null,
                tokenId: '7'
              }
            ])
          )
        })

        it('should not require an acknowledgment because it is a revocation', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
        })
      })

      describe('and it revokes an allowance from an unrecognized spender', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
          mockSimulateTransaction.mockResolvedValue(simulationWith([{ ...approval, amount: '0', rawAmount: '0' }]))
        })

        it('should not require an acknowledgment because nothing is granted', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
        })
      })

      describe('and it revokes ApprovalForAll from an unrecognized operator', () => {
        beforeEach(() => {
          mockIsKnownDecentralandContractOnChain.mockReturnValue(false)
          mockSimulateTransaction.mockResolvedValue(
            simulationWith([{ ...approval, kind: 'approvalForAll', standard: 'erc721', amount: null, rawAmount: null, approved: false }])
          )
        })

        it('should not require an acknowledgment', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
        })
      })
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

  describe('when the request id changes while the page stays mounted', () => {
    const OTHER_REQUEST_ID = 'other-request-456'
    const NavigateToOther = () => {
      const navigate = useNavigate()
      return (
        <button data-testid="go-to-other" onClick={() => navigate(`/auth/requests/${OTHER_REQUEST_ID}?targetConfigId=default`)}>
          other
        </button>
      )
    }
    const renderMountedPage = () =>
      render(
        <MemoryRouter initialEntries={[`/auth/requests/${REQUEST_ID}?targetConfigId=default`]}>
          <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
            <Routes>
              <Route
                path="/auth/requests/:requestId"
                element={
                  <>
                    <RequestPage />
                    <NavigateToOther />
                  </>
                }
              />
            </Routes>
          </FeatureFlagsContext.Provider>
        </MemoryRouter>
      )

    beforeEach(() => {
      // These tests queue one-shot values; clearAllMocks does not drain unused queues, so start clean.
      mockRecover.mockReset()
      mockSimulateTransaction.mockReset()
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
      // The first request previews; the second never resolves, so any "ready" state seen after the
      // change can only be stale.
      mockSimulateTransaction
        .mockResolvedValueOnce({ status: 'success', assetChanges: [], approvalChanges: [], balanceChanges: [], events: [] })
        .mockImplementationOnce(() => new Promise(() => undefined))
    })

    afterEach(() => {
      mockRecover.mockReset()
      mockSimulateTransaction.mockReset()
    })

    it('should drop the previous preview and show the loading view before anything of the new request', async () => {
      renderMountedPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      // Hold the new request's recovery so the state between the change and the new preview is observable.
      mockRecover.mockImplementationOnce(() => new Promise(() => undefined))
      await userEvent.click(screen.getByTestId('go-to-other'))
      expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
      expect(screen.queryByTestId('wallet-interaction')).not.toBeInTheDocument()
    })

    it('should recover the new request and preview it from scratch instead of reusing the old summary', async () => {
      renderMountedPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await userEvent.click(screen.getByTestId('go-to-other'))
      const fresh = await screen.findByTestId('wallet-interaction')
      expect(mockRecover.mock.calls.some(call => call[0] === OTHER_REQUEST_ID)).toBe(true)
      expect(fresh).toHaveAttribute('data-sim', 'loading')
    })

    describe('and the change is observed commit by commit', () => {
      let approvalUiAtCommit: boolean[]
      let CommitProbe: ({ children }: { children: React.ReactNode }) => JSX.Element

      beforeEach(() => {
        approvalUiAtCommit = []
        // A layout effect runs in the same commit as the DOM update, before any passive effect, so it
        // sees exactly what the user would see on that render.
        CommitProbe = ({ children }: { children: React.ReactNode }) => {
          // The route element is a stable reference, so the probe must subscribe to the location
          // itself to be re-rendered, and thus record, on the commit that changes the route.
          useLocation()
          useLayoutEffect(() => {
            approvalUiAtCommit.push(screen.queryByTestId('wallet-interaction-approve') !== null)
          })
          return <>{children}</>
        }
      })

      it('should show no approval UI on the very commit the route id changes, before any effect runs', async () => {
        render(
          <MemoryRouter initialEntries={[`/auth/requests/${REQUEST_ID}?targetConfigId=default`]}>
            <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
              <Routes>
                <Route
                  path="/auth/requests/:requestId"
                  element={
                    <CommitProbe>
                      <RequestPage />
                      <NavigateToOther />
                    </CommitProbe>
                  }
                />
              </Routes>
            </FeatureFlagsContext.Provider>
          </MemoryRouter>
        )
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        expect(screen.getByTestId('wallet-interaction-approve')).toBeInTheDocument()
        mockRecover.mockImplementationOnce(() => new Promise(() => undefined))
        const commitsBefore = approvalUiAtCommit.length
        await userEvent.click(screen.getByTestId('go-to-other'))
        expect(approvalUiAtCommit.length).toBeGreaterThan(commitsBefore)
        expect(approvalUiAtCommit.slice(commitsBefore).some(present => present)).toBe(false)
      })
    })

    it('should load the new request even though the previous one was completed', async () => {
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      renderMountedPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
      await screen.findByTestId('wallet-interaction-complete')
      await userEvent.click(screen.getByTestId('go-to-other'))
      await waitFor(() => expect(mockRecover.mock.calls.some(call => call[0] === OTHER_REQUEST_ID)).toBe(true))
      expect(screen.queryByTestId('wallet-interaction-complete')).not.toBeInTheDocument()
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
