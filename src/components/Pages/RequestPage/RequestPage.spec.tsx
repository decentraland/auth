/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import { useLayoutEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as viem from 'viem'
import { ProviderType } from '@dcl/schemas'
import { sendMetaTransaction } from 'decentraland-transactions'
import { TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import {
  ContractLookupUnavailableError,
  DifferentSenderError,
  ExpiredRequestError,
  ImpersonatedSignInError,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
  RecoverResponse,
  RequestFulfilledError,
  ReviewedSignerMismatchError,
  UnsupportedMethodError,
  collectCallAddresses
} from '../../../shared/auth'
import { extractReferrerFromSearchParameters, getAuthRequestId, isBridgeOnlyEnabled } from '../../../shared/locations'
import { sendTipNotification } from '../../../shared/notifications'
import { trackEvent } from '../../../shared/utils/analytics'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { RequestClassification } from './classifyRequest'
import { RequestPage } from './RequestPage'
import { TypedDataPayload } from './types'
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

// --- Auth Server Client & contract recognition ---
const mockRecover = jest.fn()
const mockSendSuccessfulOutcome = jest.fn()
const mockSendFailedOutcome = jest.fn()
const mockPostIdentity = jest.fn()
const mockGetKnownDecentralandContract = jest.fn()
const mockIsRecognizedDecentralandContract = jest.fn()
jest.mock('../../../shared/auth', () => {
  const actual = jest.requireActual('../../../shared/auth')
  return {
    ...actual,
    createAuthServerHttpClient: () => ({
      recover: mockRecover,
      sendSuccessfulOutcome: mockSendSuccessfulOutcome,
      sendFailedOutcome: mockSendFailedOutcome,
      postIdentity: mockPostIdentity
    }),
    getKnownDecentralandContract: (...args: any[]) => mockGetKnownDecentralandContract(...args),
    isRecognizedDecentralandContract: (...args: any[]) => mockIsRecognizedDecentralandContract(...args),
    resolveKnownDecentralandContract: (...args: any[]) => mockResolveKnownDecentralandContract(...args)
  }
})

// --- Classification ---
const mockGetConnectedProvider = jest.fn()
const mockIsAddressWithoutCode = jest.fn()
const mockGetCounterpartyAddresses = jest.fn()
const mockResolveKnownDecentralandContract = jest.fn()
const mockIsDecentralandCollection = jest.fn()
const mockClassifyRequest = jest.fn()
jest.mock('./classifyRequest', () => ({
  ...jest.requireActual('./classifyRequest'),
  classifyRequest: (...args: any[]) => mockClassifyRequest(...args)
}))

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
const mockIsChainMismatchRejection = jest.fn()
const mockIsUserRejectedTransaction = jest.fn()
jest.mock('../../../shared/errors', () => ({
  isErrorWithMessage: jest.fn().mockReturnValue(true),
  isRpcError: jest.fn().mockReturnValue(false),
  isUserRejectedTransaction: (...args: any[]) => mockIsUserRejectedTransaction(...args),
  isChainMismatchRejection: (...args: any[]) => mockIsChainMismatchRejection(...args)
}))
jest.mock('../../../modules/profile', () => ({
  fetchProfile: jest.fn()
}))
jest.mock('../../../modules/config', () => ({
  config: { get: jest.fn().mockReturnValue('10000') }
}))
jest.mock('../../../shared/notifications', () => ({
  sendTipNotification: jest.fn().mockResolvedValue(undefined)
}))

// --- Viem ---
const mockGetAddresses = jest.fn()
const mockSignMessage = jest.fn()
const mockGetChainId = jest.fn()
const mockEstimateFeesPerGas = jest.fn()
const mockEstimateGas = jest.fn()
const mockWalletRequest = jest.fn()

const mockPublicClient = {
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
  ...jest.requireActual('viem'),
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
  SigningError: (props: any) => (
    <div data-testid="signing-error" data-kind={props.kind ?? ''}>
      Signing Error: {props.error}
    </div>
  ),
  LookupUnavailableError: (props: any) => (
    <div data-testid="lookup-unavailable">
      <button data-testid="lookup-unavailable-try-again" onClick={props.onTryAgain}>
        try again
      </button>
    </div>
  ),
  ActionRequestView: (props: any) => (
    <div
      data-testid="action-request"
      data-kind={props.payload?.kind}
      data-payload={JSON.stringify(props.payload)}
      data-method={props.method ?? ''}
      data-approve-blocked={String(props.approveBlocked)}
      data-acknowledged={String(props.acknowledged)}
      data-review-restarted={String(props.reviewRestarted)}
    >
      <button data-testid="action-approve" onClick={props.onApprove}>
        approve
      </button>
      <button data-testid="action-acknowledge" onClick={() => props.onAcknowledgedChange?.(true)}>
        acknowledge
      </button>
      <button data-testid="action-deny" onClick={props.onDeny}>
        deny
      </button>
    </div>
  ),
  WalletInteractionComplete: () => <div data-testid="wallet-interaction-complete">Wallet Complete</div>,
  DeniedWalletInteraction: () => <div data-testid="denied-wallet-interaction">Denied Wallet</div>,
  ContinueInApp: () => <div data-testid="continue-in-app">Continue in App</div>,
  ClientLoginError: (props: any) => <div data-testid="client-login-error">Client Login Error: {props.error}</div>,
  TransferConfirmView: (props: any) => (
    <div
      data-testid="transfer-confirm"
      data-approve-blocked={String(props.approveBlocked)}
      data-chain={props.chainId ?? ''}
      data-callbacks={JSON.stringify(props.callbackAddresses ?? [])}
      data-callback-acknowledged={String(props.callbackAcknowledged)}
    >
      <button data-testid="transfer-confirm-approve" onClick={props.onApprove}>
        confirm
      </button>
      <button data-testid="callback-acknowledge" onClick={() => props.onCallbackAcknowledgedChange?.(true)}>
        acknowledge callback risk
      </button>
    </div>
  ),
  TransferCompletedView: () => <div data-testid="transfer-completed">Transfer Completed</div>,
  TransferCanceledView: () => <div data-testid="transfer-canceled">Transfer Canceled</div>,
  ConfirmRequestDialog: (props: any) =>
    props.open ? (
      <div
        data-testid="confirm-request-dialog"
        data-kind={props.kind}
        data-gas-covered={String(props.gas?.covered)}
        data-gas-status={props.gas?.status ?? ''}
      >
        <button data-testid="confirm-request-confirm" onClick={props.onConfirm}>
          confirm
        </button>
        <button data-testid="confirm-request-cancel" onClick={props.onCancel}>
          cancel
        </button>
      </div>
    ) : null
}))

// --- Utils ---
jest.mock('./utils', () => ({
  decodeManaTransferData: jest.fn().mockReturnValue(null),
  decodeNftTransferData: jest.fn().mockReturnValue(null),
  fetchNftMetadata: jest.fn(),
  fetchPlaceByCreatorAddress: jest.fn(),
  getConnectedProvider: (...args: any[]) => mockGetConnectedProvider(...args),
  getExplorerDeeplink: jest.fn().mockReturnValue('decentraland://open'),
  getSigninDeeplink: jest.fn().mockReturnValue('decentraland://open?signin=anIdentityId'),
  getMetaTransactionChainId: jest.fn().mockReturnValue(137),
  getNetworkProvider: jest.fn().mockResolvedValue({ isNetworkProvider: true }),
  isAddressWithoutCode: (...args: any[]) => mockIsAddressWithoutCode(...args),
  getCounterpartyAddresses: (...args: any[]) => mockGetCounterpartyAddresses(...args),
  isDecentralandCollection: (...args: any[]) => mockIsDecentralandCollection(...args)
}))

// Mock decentraland-transactions
jest.mock('decentraland-transactions', () => {
  // The error classes stay real: the signer-bound provider extends MetaTransactionError so the SDK rethrows it as is.
  const { ErrorCode, MetaTransactionError } = jest.requireActual('decentraland-transactions')
  return {
    ErrorCode,
    MetaTransactionError,
    ContractName: { ERC721CollectionV2: 'ERC721CollectionV2', ERC20: 'ERC20', MANAToken: 'MANAToken' },
    getContract: jest.fn().mockReturnValue({ abi: [] }),
    sendMetaTransaction: jest.fn()
  }
})

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
const SIGNER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const CONTRACT = '0xcontract'
const COLLECTION = '0xcollection'
const HELLO_HEX = '0x68656c6c6f'
// The deep-link handoff requires a valid UUID v4 route id (the client's correlation id).
const DEEP_LINK_REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'
const DEEP_LINK_REQUEST_PATH = `/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default&flow=deeplink`

// --- Fixtures. Pure builders: every scenario assigns what it needs in its own beforeEach. ---
const knownContract = (overrides: Record<string, unknown> = {}) => ({
  name: 'MANAToken',
  address: CONTRACT,
  chainId: 137,
  abi: [],
  domainName: 'Decentraland MANA',
  domainVersion: '1',
  supportsMetaTransactions: true,
  calldataField: 'functionSignature',
  ...overrides
})
const dclTransaction = (overrides: Record<string, unknown> = {}): RequestClassification =>
  ({
    kind: 'dcl_transaction',
    contract: knownContract(),
    call: { functionName: 'approve', args: [], payable: false, forwardsCall: false },
    to: CONTRACT,
    data: '0xabcd',
    value: '0x0',
    chainId: 137,
    relayed: true,
    branded: null,
    ...overrides
  }) as RequestClassification
const dclMetaTransaction = (overrides: Record<string, unknown> = {}): RequestClassification =>
  ({
    kind: 'dcl_meta_transaction',
    contract: knownContract(),
    call: { functionName: 'transfer', args: [], payable: false, forwardsCall: false },
    calldata: '0xdeadbeef',
    chainId: 137,
    typedData: { primaryType: 'MetaTransaction' },
    raw: '{"primaryType":"MetaTransaction"}',
    ...overrides
  }) as RequestClassification
const unknownTransaction = (overrides: Record<string, unknown> = {}): RequestClassification =>
  ({
    kind: 'unknown_transaction',
    to: CONTRACT,
    data: '0xabcd',
    value: '0x0',
    chainId: 1,
    reason: 'unknown_contract',
    ...overrides
  }) as RequestClassification
const recovered = (method: string, params: unknown[]): RecoverResponse => ({
  method,
  params,
  sender: SIGNER,
  expiration: new Date(Date.now() + 3600000).toISOString()
})

// What the classifier says by default, per method, so most scenarios only override the kind they need.
const defaultClassification = async (request: { method: string; params?: unknown[] }, context: { connectedChainId: number }) => {
  switch (request.method) {
    case 'eth_sendTransaction': {
      const [transaction] = (request.params ?? []) as Array<Record<string, string>>
      return unknownTransaction({
        to: transaction.to,
        data: transaction.data ?? '0x',
        value: transaction.value ?? '0x0',
        chainId: context.connectedChainId
      })
    }
    case 'personal_sign':
      return { kind: 'personal_sign', text: 'hello', hex: HELLO_HEX }
    default:
      return { kind: 'unknown_typed_data', typedData: { primaryType: 'Permit' }, raw: '{"primaryType":"Permit"}' }
  }
}

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

const rerenderRequestPage = (rerender: (ui: React.ReactElement) => void) =>
  rerender(
    <MemoryRouter initialEntries={[`/auth/requests/${REQUEST_ID}?targetConfigId=default`]}>
      <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
        <Routes>
          <Route path="/auth/requests/:requestId" element={<RequestPage />} />
        </Routes>
      </FeatureFlagsContext.Provider>
    </MemoryRouter>
  )

// The generic review always asks for the acknowledgment before Allow enables, and the page's approval
// handler enforces the same gate — plus the fee estimate, for a transaction the user pays gas for — so
// pressing Allow means giving the tick first and waiting for the gates to clear, as a user must. A test that
// skipped either would be pressing a disabled button.
const clearActionRequestGates = async () => {
  const view = await screen.findByTestId('action-request')
  await userEvent.click(screen.getByTestId('action-acknowledge'))
  await waitFor(() => expect(view).toHaveAttribute('data-approve-blocked', 'false'))
  return view
}

const approveActionRequest = async () => {
  await clearActionRequestGates()
  await userEvent.click(screen.getByTestId('action-approve'))
}

const waitForRecoverCalls = (count: number) =>
  waitFor(() => {
    if (mockRecover.mock.calls.length !== count) {
      throw new Error(`Expected recover to be called ${count} times, received ${mockRecover.mock.calls.length}`)
    }
  })

describe('RequestPage', () => {
  beforeEach(() => {
    mockSkipSetup = false
    mockFlags = {}
    mockFlagsInitialized = true
    mockTargetConfig = { skipSetup: false, explorerText: 'Explorer' }
    mockConnectionData = {
      isLoading: false,
      account: SIGNER,
      provider: { isMagic: false },
      providerType: ProviderType.INJECTED,
      identity: { ephemeralIdentity: {}, expiration: new Date(), authChain: [] }
    }
    mockClassifyRequest.mockImplementation(defaultClassification)
    mockGetKnownDecentralandContract.mockReturnValue(null)
    // Recognition follows the registry mock unless a test says otherwise (the LAND and Estate registries).
    mockIsRecognizedDecentralandContract.mockImplementation(
      (address: string, chainId: number) => mockGetKnownDecentralandContract(address, chainId) !== null
    )
    mockIsChainMismatchRejection.mockReturnValue(false)
    mockIsUserRejectedTransaction.mockReturnValue(false)
    // Every real provider exposes EIP-1193 request; the signer binding refuses one that does not.
    mockGetConnectedProvider.mockResolvedValue({ request: jest.fn().mockResolvedValue([SIGNER]) })
    mockIsAddressWithoutCode.mockResolvedValue(true)
    mockGetCounterpartyAddresses.mockReturnValue({ addresses: [], opaque: false })
    mockResolveKnownDecentralandContract.mockResolvedValue({ status: 'not_found' })
    mockIsDecentralandCollection.mockResolvedValue(false)
    mockGetChainId.mockResolvedValue(1)
    mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
    mockEstimateGas.mockResolvedValue(BigInt(21000))
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
      let referrer: string

      beforeEach(() => {
        referrer = '0x24e5f44999c151f08609f8e27b2238c773c4d020'
        ;(extractReferrerFromSearchParameters as jest.Mock).mockReturnValue(referrer)
      })

      afterEach(() => {
        ;(extractReferrerFromSearchParameters as jest.Mock).mockReturnValue(null)
      })

      it('should preserve the referrer inside the login redirectTo so it survives the round-trip', async () => {
        renderRequestPage(`/auth/requests/${REQUEST_ID}?targetConfigId=default&referrer=${referrer}`)
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(`referrer%3D${referrer}`))
        })
      })

      it('should also pass the referrer as a top-level /login param so the login page can hand it to setup', async () => {
        // LoginPage reads the referrer from its OWN url (not from inside redirectTo) when
        // routing a new user to profile setup — without the top-level param the referral
        // POST never fires for a not-yet-connected wallet user.
        renderRequestPage(`/auth/requests/${REQUEST_ID}?targetConfigId=default&referrer=${referrer}`)
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(`&referrer=${referrer}`))
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
    beforeEach(() => {
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'User' }] })
    })

    describe('and Thirdweb receives a typed-data v3 request', () => {
      beforeEach(async () => {
        mockConnectionData = { ...mockConnectionData, providerType: ProviderType.THIRDWEB }
        mockRecover.mockResolvedValueOnce(recovered('eth_signTypedData_v3', [SIGNER, '{"primaryType":"Permit"}']))
        mockSendFailedOutcome.mockResolvedValueOnce({})
        renderRequestPage()
        await screen.findByTestId('recover-error')
      })

      it('should report an unsupported method to the requester', () => {
        expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
          code: -32601,
          message: 'The "eth_signTypedData_v3" method is not supported'
        })
      })

      it('should refuse before building a review or asking the wallet', () => {
        expect(mockClassifyRequest).not.toHaveBeenCalled()
        expect(mockWalletRequest).not.toHaveBeenCalled()
        expect(screen.queryByTestId('confirm-request-dialog')).not.toBeInTheDocument()
      })
    })

    describe('and an external wallet receives a typed-data v3 request', () => {
      beforeEach(async () => {
        mockRecover.mockResolvedValueOnce(recovered('eth_signTypedData_v3', [SIGNER, '{"primaryType":"Permit"}']))
        mockWalletRequest.mockResolvedValueOnce('0xsignature')
        mockSendSuccessfulOutcome.mockResolvedValueOnce({})
        renderRequestPage()
        await approveActionRequest()
      })

      it('should continue signing with the requested v3 method', () => {
        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_signTypedData_v3',
          params: [SIGNER, '{"primaryType":"Permit"}']
        })
      })
    })

    describe('and Thirdweb receives a typed-data v4 request', () => {
      beforeEach(async () => {
        mockConnectionData = { ...mockConnectionData, providerType: ProviderType.THIRDWEB }
        mockRecover.mockResolvedValueOnce(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"Permit"}']))
        mockWalletRequest.mockResolvedValueOnce('0xsignature')
        mockSendSuccessfulOutcome.mockResolvedValueOnce({})
        renderRequestPage()
        await approveActionRequest()
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
      })

      it('should continue signing v4 after confirmation', () => {
        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_signTypedData_v4',
          params: [SIGNER, '{"primaryType":"Permit"}']
        })
      })
    })

    describe('and recovery fails with an UnsupportedMethodError (the retired dcl_personal_sign sign-in)', () => {
      beforeEach(() => {
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
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
            code: -32601,
            message: 'The "dcl_personal_sign" method is not supported'
          })
        })
      })
    })

    describe('and recovery fails with an UnsupportedMethodError for any other method', () => {
      beforeEach(() => {
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
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
            code: -32601,
            message: 'The "eth_sign" method is not supported'
          })
        })
      })
    })

    describe("and the request is a transaction to a contract that is not Decentraland's", () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0x1234', value: '0' }]))
      })

      it('should show the generic review with the transaction exactly as the wallet will be handed it', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('action-request')
        expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual({
          kind: 'transaction',
          to: CONTRACT,
          data: '0x1234',
          value: '0',
          chainId: 1,
          // The wallet sends this one itself, so the block is worded as the bytes it receives.
          relayed: false
        })
      })

      it('should classify the request for the connected signer and chain', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        expect(mockClassifyRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'eth_sendTransaction' }),
          expect.objectContaining({ signerAddress: SIGNER, connectedChainId: 1, metaTransactionChainId: 137 })
        )
      })

      it('should report the classification to analytics without the payload', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        expect(jest.mocked(trackEvent)).toHaveBeenCalledWith(TrackingEvents.REQUEST_CLASSIFIED, {
          requestId: REQUEST_ID,
          kind: 'unknown_transaction',
          reason: 'unknown_contract'
        })
      })
    })

    describe('and the wallet network cannot be read while reviewing a transaction', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0x1234', value: '0' }]))
        mockGetChainId.mockRejectedValue(new Error('rpc down'))
      })

      it('should show the retryable error view instead of a review on an unknown chain', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('recover-error')).toBeInTheDocument()
        expect(mockClassifyRequest).not.toHaveBeenCalled()
      })
    })

    describe('and the collection factories cannot say whether the target is a Decentraland collection', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: COLLECTION, data: '0x1234', value: '0' }]))
        mockClassifyRequest.mockRejectedValue(new ContractLookupUnavailableError(COLLECTION))
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the lookup-unavailable view with its own retry instead of a review', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('lookup-unavailable')).toBeInTheDocument()
        expect(screen.queryByTestId('recover-error')).not.toBeInTheDocument()
      })

      it('should leave the request unanswered so a retry can review it', async () => {
        renderRequestPage()
        await screen.findByTestId('lookup-unavailable')
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      })

      describe('and the user tries again once the lookup can answer', () => {
        beforeEach(() => {
          mockClassifyRequest.mockReset()
          mockClassifyRequest
            .mockRejectedValueOnce(new ContractLookupUnavailableError(COLLECTION))
            .mockImplementation(defaultClassification)
        })

        it('should review the same request again on this page without a notice or an outcome', async () => {
          renderRequestPage()
          await userEvent.click(await screen.findByTestId('lookup-unavailable-try-again'))
          const view = await screen.findByTestId('action-request')
          expect(view).toHaveAttribute('data-review-restarted', 'false')
          expect(mockRecover).toHaveBeenCalledTimes(2)
          expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        })
      })
    })

    describe('and the classifier refuses a call to a Decentraland contract that deviates from what the SDK builds', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0x095ea7b300', value: '0' }]))
        mockClassifyRequest.mockRejectedValue(
          new MalformedTransactionRequestError(
            'eth_sendTransaction',
            'the calldata is not a call the Decentraland MANAToken contract declares'
          )
        )
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the error view instead of the generic review', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('signing-error')).toBeInTheDocument()
        expect(screen.queryByTestId('action-request')).not.toBeInTheDocument()
      })

      it('should explain the refusal as a malformed transaction in the user-facing copy', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('signing-error')).toHaveAttribute('data-kind', 'malformed_transaction')
      })

      it('should answer the request as invalid so it cannot be retried into a review', async () => {
        renderRequestPage()
        await screen.findByTestId('signing-error')
        await waitFor(() => {
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
            code: -32602,
            message:
              'The "eth_sendTransaction" transaction parameters are malformed: the calldata is not a call the Decentraland MANAToken contract declares'
          })
        })
      })
    })

    describe('and recovery fails with a DifferentSenderError', () => {
      beforeEach(() => {
        mockRecover.mockRejectedValue(new DifferentSenderError(SIGNER, '0xother'))
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
        mockRecover.mockRejectedValue(new RequestFulfilledError(REQUEST_ID))
      })

      it('should show the interaction complete view (request already consumed)', async () => {
        renderRequestPage()
        await waitFor(() => {
          expect(mockRecover).toHaveBeenCalled()
        })
        await waitFor(() => {
          expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
        })
      })
    })

    describe('and recovery fails with an unexpected error', () => {
      beforeEach(() => {
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
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
            code: -32602,
            message: 'The "personal_sign" method cannot be used to sign a Decentraland sign-in payload'
          })
        })
      })
    })

    describe('and recovery fails with a MalformedTransactionRequestError', () => {
      beforeEach(() => {
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
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
            code: -32602,
            message: 'The "eth_sendTransaction" transaction parameters are malformed: "to" must be an address'
          })
        )
      })
    })

    describe('and recovery fails with a MalformedSignatureRequestError', () => {
      beforeEach(() => {
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
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
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
        mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
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
        let path: string

        beforeEach(() => {
          path = '/auth/requests/not-a-uuid?targetConfigId=default&flow=deeplink'
        })

        it('should show the error view without posting an identity or recovering a request', async () => {
          renderRequestPage(path)
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toBeInTheDocument()
          })
          expect(mockPostIdentity).not.toHaveBeenCalled()
          expect(mockRecover).not.toHaveBeenCalled()
        })

        it('should not run the profile consistency check', async () => {
          renderRequestPage(path)
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toBeInTheDocument()
          })
          expect(mockEnsureProfile).not.toHaveBeenCalled()
        })

        it('should explain that the sign-in link is invalid', async () => {
          renderRequestPage(path)
          await waitFor(() => {
            expect(screen.getByTestId('client-login-error')).toHaveTextContent('The sign-in link is invalid.')
          })
        })

        it('should track the failure with an invalid_request_id reason', async () => {
          renderRequestPage(path)
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
        mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      })

      it('should recover the request normally and not post an identity', async () => {
        renderRequestPage(`/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default`)
        await waitFor(() => {
          expect(mockRecover).toHaveBeenCalledWith(DEEP_LINK_REQUEST_ID, SIGNER)
        })
        expect(mockPostIdentity).not.toHaveBeenCalled()
      })
    })

    describe('and the wallet changes while profile consistency is loading', () => {
      let resolveProfile: (value: any) => void
      let newConnectionData: Record<string, any>

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
        newConnectionData = {
          ...mockConnectionData,
          account: '0xnewwallet',
          provider: { isMagic: false, isNewProvider: true },
          providerType: ProviderType.INJECTED
        }
      })

      it('should cancel the stale request and not set state from the old wallet', async () => {
        const { rerender } = renderRequestPage()

        // Wait for the profile check to start
        await waitFor(() => {
          expect(mockEnsureProfile).toHaveBeenCalledWith(SIGNER, expect.anything(), expect.anything())
        })

        // Simulate wallet change: update the mock and re-render with new connection data
        mockConnectionData = newConnectionData
        rerenderRequestPage(rerender)

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
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      // The first recovery is the reviewing account's; the new account's own recovery is held so the
      // state in between is observable.
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockResolvedValue(['0xnewwallet'])
      mockRecover
        .mockResolvedValueOnce(recovered('personal_sign', ['hello', SIGNER]))
        .mockImplementation(() => new Promise(() => undefined))
    })

    it('should drop the previous review and show the loading view until the new account has recovered the request', async () => {
      const { rerender } = renderRequestPage()
      expect(await screen.findByTestId('action-request')).toBeInTheDocument()

      mockConnectionData = { ...mockConnectionData, account: '0xnewwallet' }
      rerenderRequestPage(rerender)

      expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
      expect(screen.queryByTestId('action-approve')).not.toBeInTheDocument()
    })
  })

  describe('when the account changes while Allow is still waiting for the wallet, which then rejects', () => {
    let rejectWallet: (error: unknown) => void

    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      // Recovery and Allow see the reviewing account; from then on the wallet reports the new one, which the
      // new review recovers with (its own recovery is held so the state in between is observable).
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockResolvedValueOnce([SIGNER]).mockResolvedValue(['0xnewwallet'])
      mockRecover
        .mockResolvedValueOnce(recovered('personal_sign', ['hello', SIGNER]))
        .mockImplementation(() => new Promise(() => undefined))
      mockWalletRequest.mockImplementationOnce(() => new Promise((_, reject) => (rejectWallet = reject)))
      mockIsUserRejectedTransaction.mockReturnValue(true)
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should send no rejection at all, since the account that reviewed the request is no longer the wallet account', async () => {
      const { rerender } = renderRequestPage()
      await approveActionRequest()
      await waitFor(() => expect(mockWalletRequest).toHaveBeenCalledTimes(1))

      mockConnectionData = { ...mockConnectionData, account: '0xnewwallet' }
      rerenderRequestPage(rerender)
      // The new review has read the wallet's account (the third read) before the old prompt is answered.
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(3))

      rejectWallet(new Error('User rejected the request'))

      // The old action reads the account once more to decide whom to report for, then stops.
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(4))
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      expect(screen.getByTestId('loading-request')).toBeInTheDocument()
    })
  })

  describe('when delivering a denial fails', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockSendFailedOutcome.mockRejectedValue(new Error('server down'))
    })

    afterEach(() => {
      jest.mocked(console.error).mockRestore()
    })

    it('should still show the denied view, since the decision stands whatever the server heard', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('action-deny'))
      expect(await screen.findByTestId('denied-wallet-interaction')).toBeInTheDocument()
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })
  })

  describe('when the account changes while Deny is still waiting for its outcome to be delivered', () => {
    let deliverOutcome: () => void

    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      // Recovery and Deny both see the reviewing account; the new account's own recovery is held so
      // the state in between is observable.
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockResolvedValueOnce([SIGNER]).mockResolvedValue(['0xnewwallet'])
      mockRecover
        .mockResolvedValueOnce(recovered('personal_sign', ['hello', SIGNER]))
        .mockImplementation(() => new Promise(() => undefined))
      mockSendFailedOutcome.mockReset()
      mockSendFailedOutcome.mockImplementationOnce(
        () => new Promise<Record<string, never>>(resolve => (deliverOutcome = () => resolve({})))
      )
    })

    it('should keep the new account on the loading view and never show the old denial', async () => {
      const { rerender } = renderRequestPage()
      await userEvent.click(await screen.findByTestId('action-deny'))
      await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))

      mockConnectionData = { ...mockConnectionData, account: '0xnewwallet' }
      rerenderRequestPage(rerender)
      expect(await screen.findByTestId('loading-request')).toBeInTheDocument()

      deliverOutcome()

      await waitFor(() => expect(mockRecover).toHaveBeenCalledTimes(2))
      expect(screen.getByTestId('loading-request')).toBeInTheDocument()
      expect(screen.queryByTestId('denied-wallet-interaction')).not.toBeInTheDocument()
    })
  })

  describe('when the wallet reports a different active account at approval time than the one that reviewed the request', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      // The request is recovered by the reviewing account; by the time Allow is clicked the wallet has
      // moved on to another one.
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockResolvedValue(['0xnewwallet'])
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should not forward the request to the wallet', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    it('should not report an outcome for it', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the different-account view instead of leaving an Allow button that does nothing', async () => {
      renderRequestPage()
      await approveActionRequest()
      expect(await screen.findByTestId('different-account')).toBeInTheDocument()
    })
  })

  describe('when the request expires while it is still being classified', () => {
    let resolveClassification: (classification: RequestClassification) => void

    beforeEach(() => {
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue({
        ...recovered('personal_sign', ['hello', SIGNER]),
        expiration: new Date(Date.now() + 50).toISOString()
      })
      mockClassifyRequest.mockImplementation(
        () =>
          new Promise<RequestClassification>(resolve => {
            resolveClassification = resolve
          })
      )
    })

    it('should keep the timeout view although the classification resolves afterwards', async () => {
      renderRequestPage()
      await waitFor(() => expect(mockClassifyRequest).toHaveBeenCalled())
      expect(await screen.findByTestId('timeout-error')).toBeInTheDocument()
      await act(async () => {
        resolveClassification({ kind: 'personal_sign', text: 'hello', hex: HELLO_HEX })
      })
      expect(screen.getByTestId('timeout-error')).toBeInTheDocument()
      expect(screen.queryByTestId('action-request')).not.toBeInTheDocument()
    })
  })

  describe('when Allow and Deny are clicked before React disables either button', () => {
    beforeEach(() => {
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should perform only the first operation and answer the request once', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      fireEvent.click(screen.getByTestId('action-approve'))
      fireEvent.click(screen.getByTestId('action-deny'))
      await waitFor(() => expect(mockSendSuccessfulOutcome).toHaveBeenCalledTimes(1))
      expect(mockWalletRequest).toHaveBeenCalledTimes(1)
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should answer a double Deny once', async () => {
      renderRequestPage()
      const deny = await screen.findByTestId('action-deny')
      fireEvent.click(deny)
      fireEvent.click(deny)
      await screen.findByTestId('denied-wallet-interaction')
      await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })
  })

  describe('when the wallet answers Allow with the account that reviewed the request', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockSendFailedOutcome.mockResolvedValue({})
    })

    describe('and the wallet reports that the user rejected the request', () => {
      beforeEach(() => {
        mockWalletRequest.mockRejectedValue(new Error('User rejected the request'))
        mockIsUserRejectedTransaction.mockReturnValue(true)
      })

      it('should show the denied view and answer the request as rejected once', async () => {
        renderRequestPage()
        await approveActionRequest()
        expect(await screen.findByTestId('denied-wallet-interaction')).toBeInTheDocument()
        expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1)
        expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, { code: -32003, message: 'Transaction rejected' })
      })
    })

    describe('and the wallet fails for another reason', () => {
      beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        mockWalletRequest.mockRejectedValue(new Error('Internal wallet error'))
      })

      afterEach(() => {
        jest.mocked(console.error).mockRestore()
      })

      it('should show the wallet error view with the error for the developer', async () => {
        renderRequestPage()
        await approveActionRequest()
        const error = await screen.findByTestId('signing-error')
        expect(error).toHaveAttribute('data-kind', 'wallet_error')
        expect(error).toHaveTextContent('Internal wallet error')
      })

      it('should answer the request with the wallet error', async () => {
        renderRequestPage()
        await approveActionRequest()
        await screen.findByTestId('signing-error')
        await waitFor(() =>
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, { code: 999, message: 'Internal wallet error' })
        )
      })
    })
  })

  describe('when the wallet account changes while the wallet prompt is open', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      // Recovered and verified as the reviewing account; by the time the wallet answers, another one is active.
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockResolvedValueOnce([SIGNER]).mockResolvedValue(['0xnewwallet'])
      mockSendFailedOutcome.mockResolvedValue({})
    })

    describe('and the wallet reports that the user rejected the request', () => {
      beforeEach(() => {
        mockWalletRequest.mockRejectedValue(new Error('User rejected the request'))
        mockIsUserRejectedTransaction.mockReturnValue(true)
      })

      it('should send no outcome and show the account-change view', async () => {
        renderRequestPage()
        await approveActionRequest()
        expect(await screen.findByTestId('different-account')).toBeInTheDocument()
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      })
    })

    describe('and the wallet fails for another reason', () => {
      beforeEach(() => {
        mockWalletRequest.mockRejectedValue(new Error('Internal wallet error'))
      })

      it('should send no outcome and show the account-change view instead of the error view', async () => {
        renderRequestPage()
        await approveActionRequest()
        expect(await screen.findByTestId('different-account')).toBeInTheDocument()
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('when the wallet changes network after a plain transaction was reviewed', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(
        recovered('eth_sendTransaction', [{ to: '0x0000000000000000000000000000000000000001', data: '0x', value: '0x0' }])
      )
      mockGetAddresses.mockResolvedValue([SIGNER])
      // The request is reviewed on Polygon, then the same account is active on Ethereum at approval.
      mockGetChainId.mockResolvedValue(1).mockResolvedValueOnce(137)
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should not forward the transaction to the wallet', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    it('should recover the request again so it can be reviewed on the current network', async () => {
      renderRequestPage()
      await approveActionRequest()

      await waitFor(() => expect(mockRecover).toHaveBeenCalledTimes(2))
    })

    it('should not report a successful outcome for the invalidated review', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
    })

    it('should not report a failed outcome for the invalidated review', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should tell the user on the fresh review that the network changed', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-review-restarted', 'true'))
    })

    it('should report the restart and its reason to analytics', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(jest.mocked(trackEvent)).toHaveBeenCalledWith(TrackingEvents.TRANSACTION_REVIEW_RESTARTED, {
        requestId: REQUEST_ID,
        reason: 'network_changed'
      })
    })
  })

  describe('when the wallet refuses the send because its network changed after the check', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(
        recovered('eth_sendTransaction', [{ to: '0x0000000000000000000000000000000000000001', data: '0x', value: '0x0' }])
      )
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockGetChainId.mockResolvedValue(137)
      // The chain matched at the check; the wallet switched in the last moment and rejected the bound request.
      mockWalletRequest.mockRejectedValueOnce(Object.assign(new Error('Invalid transaction params: chainId mismatch'), { code: -32602 }))
      mockIsChainMismatchRejection.mockReturnValue(true)
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should recover the request again instead of consuming it as a failure', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should not show the signing error view', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
    })

    it('should report the restart with the wallet rejection as its reason', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(jest.mocked(trackEvent)).toHaveBeenCalledWith(TrackingEvents.TRANSACTION_REVIEW_RESTARTED, {
        requestId: REQUEST_ID,
        reason: 'wallet_rejected_chain'
      })
    })
  })

  describe('when the wallet network cannot be read at approval time', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(
        recovered('eth_sendTransaction', [{ to: '0x0000000000000000000000000000000000000001', data: '0x', value: '0x0' }])
      )
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockGetChainId.mockResolvedValue(137).mockResolvedValueOnce(137).mockRejectedValueOnce(new Error('Network unavailable'))
      mockWalletRequest.mockResolvedValue('0xhash')
    })

    it('should recover the request again instead of consuming it as a failure', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitForRecoverCalls(2)

      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })
  })

  describe('when the wallet reports a different active account at denial time than the one that reviewed the request', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockResolvedValue(['0xnewwallet'])
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should not report a rejection from an account that never reviewed the request', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('action-deny'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the different-account view', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('action-deny'))
      expect(await screen.findByTestId('different-account')).toBeInTheDocument()
    })
  })

  describe('when the request is a signature Decentraland cannot check', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    describe('and it is a personal_sign', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      })

      it('should show the generic review with the bytes and the text', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('action-request')
        expect(view).toHaveAttribute('data-kind', 'message')
        expect(view).toHaveAttribute('data-payload', JSON.stringify({ kind: 'message', hex: HELLO_HEX, text: 'hello' }))
      })

      it('should hand the wallet the message bytes and the signer on approval', async () => {
        renderRequestPage()
        await approveActionRequest()
        await waitFor(() => {
          expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: [HELLO_HEX, SIGNER] })
        })
      })

      it('should complete the interaction after a successful signature', async () => {
        renderRequestPage()
        await approveActionRequest()
        expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
      })
    })

    describe('and it is typed data that is not a MetaTransaction', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"Permit"}']))
      })

      it('should show the generic review with the raw JSON', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('action-request')
        expect(view).toHaveAttribute('data-kind', 'typed_data')
        expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual({ kind: 'typed_data', raw: '{"primaryType":"Permit"}' })
      })

      it('should hand the wallet the signer and the typed data on approval', async () => {
        renderRequestPage()
        await approveActionRequest()
        await waitFor(() => {
          expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'eth_signTypedData_v4', params: [SIGNER, '{"primaryType":"Permit"}'] })
        })
      })
    })

    describe('and it is a MetaTransaction Decentraland cannot vouch for', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"MetaTransaction"}']))
        mockClassifyRequest.mockResolvedValue({
          kind: 'unknown_meta_transaction',
          typedData: { primaryType: 'MetaTransaction', message: { functionSignature: '0xdeadbeef' } },
          raw: '{"primaryType":"MetaTransaction"}',
          verifyingContract: '0xunknown',
          chainId: 137,
          reason: 'unknown_contract'
        })
      })

      it('should show the generic review with only the original typed data', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('action-request')).toHaveAttribute(
          'data-payload',
          JSON.stringify({ kind: 'typed_data', raw: '{"primaryType":"MetaTransaction"}' })
        )
      })

      describe('and it carries an unsigned decoy call', () => {
        let raw: string
        let typedData: TypedDataPayload

        beforeEach(() => {
          typedData = {
            types: { MetaTransaction: [{ name: 'functionData', type: 'bytes' }] },
            domain: {},
            primaryType: 'MetaTransaction',
            message: { functionData: '0xceefad9f', functionSignature: '0x18160ddd' }
          }
          raw = JSON.stringify(typedData)
          mockRecover.mockResolvedValueOnce(recovered('eth_signTypedData_v4', [SIGNER, raw]))
          mockClassifyRequest.mockResolvedValueOnce({
            kind: 'unknown_meta_transaction',
            typedData,
            raw,
            verifyingContract: CONTRACT,
            chainId: 137,
            reason: 'unknown_contract'
          })
        })

        it('should pass only the original JSON to the view without endorsing the decoy', async () => {
          renderRequestPage()
          expect(await screen.findByTestId('action-request')).toHaveAttribute('data-payload', JSON.stringify({ kind: 'typed_data', raw }))
        })

        it('should forward the original payload on approval', async () => {
          renderRequestPage()
          await approveActionRequest()
          await waitFor(() => expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'eth_signTypedData_v4', params: [SIGNER, raw] }))
        })
      })
    })

    describe('and nested duplicate fields make hashing exponentially expensive', () => {
      let raw: string
      let typedData: TypedDataPayload
      let hash: jest.SpyInstance

      beforeEach(() => {
        typedData = { types: { Leaf: [{ name: 'value', type: 'uint256' }] }, domain: {}, primaryType: 'T0', message: { value: 1 } }
        for (let index = 24; index >= 0; index--) {
          typedData.types![`T${index}`] = [
            { name: 'x', type: index === 24 ? 'Leaf' : `T${index + 1}` },
            { name: 'x', type: index === 24 ? 'Leaf' : `T${index + 1}` }
          ]
          typedData.message = { x: typedData.message }
        }
        raw = JSON.stringify(typedData)
        // Fail safely if hashing is reintroduced: the real payload would stall the test runner.
        hash = jest.spyOn(viem, 'hashTypedData').mockImplementation(() => {
          throw new Error('Unvalidated data must not be hashed')
        })
        mockRecover.mockResolvedValueOnce(recovered('eth_signTypedData_v4', [SIGNER, raw]))
        mockClassifyRequest.mockImplementationOnce(jest.requireActual('./classifyRequest').classifyRequest)
      })

      afterEach(() => {
        hash.mockRestore()
      })

      it('should show the original JSON without hashing it during classification or rendering', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('action-request')).toHaveAttribute('data-payload', JSON.stringify({ kind: 'typed_data', raw }))
        expect(hash).not.toHaveBeenCalled()
      })

      it('should keep the request deniable without hashing on a rerender', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('action-deny'))
        expect(await screen.findByTestId('denied-wallet-interaction')).toBeInTheDocument()
        expect(hash).not.toHaveBeenCalled()
      })
    })
  })

  describe('when the wallet executed the request but delivering its outcome fails', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockRejectedValue(new Error('Network error'))
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should not report a failed outcome for an action the wallet already performed', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitFor(() => {
        expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
      })
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the completion view instead of an error that would invite a second signature', async () => {
      renderRequestPage()
      await approveActionRequest()
      expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
    })

    describe('and the failure is an expected already-fulfilled race', () => {
      beforeEach(() => {
        mockSendSuccessfulOutcome.mockRejectedValue(new RequestFulfilledError(REQUEST_ID))
      })

      it('should show the completion view without reporting a failed outcome', async () => {
        renderRequestPage()
        await approveActionRequest()
        await waitFor(() => {
          expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
        })
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      })
    })
  })

  describe("when the request is a transaction to a contract that is not Decentraland's", () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should estimate the fee the user will pay before Allow enables', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockEstimateGas).toHaveBeenCalledWith({ account: SIGNER, to: CONTRACT, data: '0xabcd', value: BigInt(0) })
    })

    describe('and the fee estimate has not answered yet', () => {
      beforeEach(() => {
        mockEstimateGas.mockReturnValue(new Promise(() => undefined))
      })

      it('should keep Allow blocked after the acknowledgment, so the web2 confirmation can always state the cost', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('action-request')
        await userEvent.click(screen.getByTestId('action-acknowledge'))
        await waitFor(() => expect(view).toHaveAttribute('data-acknowledged', 'true'))
        expect(view).toHaveAttribute('data-approve-blocked', 'true')
      })

      it('should send nothing if Allow is pressed anyway', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('action-request')
        await userEvent.click(screen.getByTestId('action-acknowledge'))
        await waitFor(() => expect(view).toHaveAttribute('data-acknowledged', 'true'))
        // Pressed raw on purpose: the double's button is not disabled, so this is the press the handler
        // itself has to refuse.
        await userEvent.click(screen.getByTestId('action-approve'))
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })
    })

    it('should send it as a plain transaction on the reviewed chain, never through the relay', async () => {
      renderRequestPage()
      await approveActionRequest()
      await screen.findByTestId('wallet-interaction-complete')
      expect(mockWalletRequest).toHaveBeenCalledWith({
        method: 'eth_sendTransaction',
        params: [{ to: CONTRACT, data: '0xabcd', value: '0x0', from: SIGNER, chainId: '0x1' }]
      })
      expect(sendMetaTransaction).not.toHaveBeenCalled()
    })

    describe('and the fee cannot be estimated', () => {
      beforeEach(() => {
        mockEstimateGas.mockRejectedValue(new Error('execution reverted'))
      })

      it('should still let the transaction be sent once acknowledged, since the fee is settled as unknown', async () => {
        renderRequestPage()
        await approveActionRequest()
        await screen.findByTestId('wallet-interaction-complete')
        expect(mockWalletRequest).toHaveBeenCalledTimes(1)
      })
    })

    describe('and the request carries fee, gas and other non-reviewed fields', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(
          recovered('eth_sendTransaction', [
            {
              from: '0xattacker',
              to: CONTRACT,
              data: '0x',
              value: '0x0',
              gas: '0x5208',
              maxFeePerGas: '0x26f2c8b1a76',
              maxPriorityFeePerGas: '0x26f2c8b1a76',
              nonce: '0x1',
              type: '0x2'
            }
          ])
        )
      })

      it('should omit unreviewed request fields and bind the trusted sender and chain', async () => {
        renderRequestPage()
        await approveActionRequest()
        await screen.findByTestId('wallet-interaction-complete')

        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_sendTransaction',
          params: [{ to: CONTRACT, data: '0x', value: '0x0', from: SIGNER, chainId: '0x1' }]
        })
      })
    })
  })

  describe('when a web2 user approves a request', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.THIRDWEB }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    describe('and it is a transaction the user pays gas for', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      })

      it('should ask for a confirmation that names the transaction and its fee instead of sending immediately', async () => {
        renderRequestPage()
        await approveActionRequest()
        const dialog = await screen.findByTestId('confirm-request-dialog')
        expect(dialog).toHaveAttribute('data-kind', 'transaction')
        await waitFor(() => expect(dialog).toHaveAttribute('data-gas-status', 'ready'))
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })

      it('should send the transaction once the confirmation is given', async () => {
        renderRequestPage()
        await approveActionRequest()
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
        await screen.findByTestId('wallet-interaction-complete')
        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_sendTransaction',
          params: [{ to: CONTRACT, data: '0xabcd', value: '0x0', from: SIGNER, chainId: '0x1' }]
        })
      })

      it('should close the confirmation on cancel without sending', async () => {
        renderRequestPage()
        await approveActionRequest()
        await userEvent.click(await screen.findByTestId('confirm-request-cancel'))
        expect(screen.queryByTestId('confirm-request-dialog')).not.toBeInTheDocument()
        expect(screen.getByTestId('action-request')).toBeInTheDocument()
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })
    })

    describe('and it is a relayed Decentraland transaction', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
        mockClassifyRequest.mockResolvedValue(dclTransaction())
        jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      })

      it('should ask for a confirmation that says gas is covered', async () => {
        renderRequestPage()
        await approveActionRequest()
        const dialog = await screen.findByTestId('confirm-request-dialog')
        expect(dialog).toHaveAttribute('data-kind', 'transaction')
        expect(dialog).toHaveAttribute('data-gas-covered', 'true')
        expect(sendMetaTransaction).not.toHaveBeenCalled()
      })

      it('should relay once the confirmation is given', async () => {
        renderRequestPage()
        await approveActionRequest()
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
        await screen.findByTestId('wallet-interaction-complete')
        expect(sendMetaTransaction).toHaveBeenCalledTimes(1)
      })
    })

    describe('and it is a signature', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      })

      it('should ask for a confirmation that names the signature and shows no fee', async () => {
        renderRequestPage()
        await approveActionRequest()
        const dialog = await screen.findByTestId('confirm-request-dialog')
        expect(dialog).toHaveAttribute('data-kind', 'signature')
        expect(dialog).toHaveAttribute('data-gas-covered', 'undefined')
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })

      it('should sign once the confirmation is given', async () => {
        renderRequestPage()
        await approveActionRequest()
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
        await screen.findByTestId('wallet-interaction-complete')
        expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: [HELLO_HEX, SIGNER] })
      })
    })

    describe('and it is a Decentraland meta-transaction signature', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"MetaTransaction"}']))
        mockClassifyRequest.mockResolvedValue(dclMetaTransaction())
      })

      it('should ask for a confirmation before signing', async () => {
        renderRequestPage()
        await approveActionRequest()
        expect(await screen.findByTestId('confirm-request-dialog')).toHaveAttribute('data-kind', 'signature')
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })
    })
  })

  describe('when the request is a plain value transfer', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: '0xrecipient', value: '0xde0b6b3a7640000' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue({
        kind: 'native_transfer',
        to: '0xrecipient',
        value: '0xde0b6b3a7640000',
        chainId: 1,
        toSelf: false
      })
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should show the generic review with the recipient, the amount and no calldata', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual({
        kind: 'transaction',
        to: '0xrecipient',
        data: '0x',
        value: '0xde0b6b3a7640000',
        chainId: 1
      })
    })

    it('should estimate the fee for the value being sent before Allow enables', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockEstimateGas).toHaveBeenCalledWith({ account: SIGNER, to: '0xrecipient', data: '0x', value: BigInt('0xde0b6b3a7640000') })
    })

    it('should send it as a plain transaction on the reviewed chain', async () => {
      renderRequestPage()
      await approveActionRequest()
      await screen.findByTestId('wallet-interaction-complete')
      expect(mockWalletRequest).toHaveBeenCalledWith({
        method: 'eth_sendTransaction',
        params: [{ to: '0xrecipient', data: '0x', value: '0xde0b6b3a7640000', from: SIGNER, chainId: '0x1' }]
      })
      expect(sendMetaTransaction).not.toHaveBeenCalled()
    })
  })

  describe('when the request is a transaction to a Decentraland contract that is relayed', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should show the generic review with the calldata the relay will be handed, on the chain it executes on', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual({
        kind: 'transaction',
        to: CONTRACT,
        data: '0xabcd',
        value: '0x0',
        chainId: 137,
        // Relayed, so the view words the block as the action and says a signature will be asked for.
        relayed: true
      })
    })

    it('should ask for the acknowledgment whatever the call does, and block Allow until it is given', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(view).toHaveAttribute('data-acknowledged', 'false')
      expect(view).toHaveAttribute('data-approve-blocked', 'true')
      // Pressed raw on purpose: the double's button is not disabled, so this is the press the handler
      // itself has to refuse.
      await userEvent.click(screen.getByTestId('action-approve'))
      expect(sendMetaTransaction).not.toHaveBeenCalled()
    })

    it('should enable Allow on the acknowledgment alone, without a fee estimate, since the relay covers gas', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockEstimateGas).not.toHaveBeenCalled()
    })

    it('should not check the contracts the call reaches, since nothing is vouched for on this screen', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockGetCounterpartyAddresses).not.toHaveBeenCalled()
      expect(mockIsAddressWithoutCode).not.toHaveBeenCalled()
      expect(mockIsDecentralandCollection).not.toHaveBeenCalled()
    })

    it('should relay the reviewed calldata through the classified contract on approval', async () => {
      renderRequestPage()
      await approveActionRequest()
      await screen.findByTestId('wallet-interaction-complete')
      expect(sendMetaTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ request: expect.any(Function) }),
        { isNetworkProvider: true },
        '0xabcd',
        { abi: [], address: CONTRACT, name: 'Decentraland MANA', version: '1', chainId: 137 },
        { serverURL: '10000/v1' }
      )
      expect(mockWalletRequest).not.toHaveBeenCalled()
      expect(mockSendSuccessfulOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, '0xrelayedhash')
    })

    describe('and the wallet switches account before the relay reads it', () => {
      let providerRequest: jest.Mock

      beforeEach(() => {
        providerRequest = jest.fn().mockResolvedValue(['0xnewwallet'])
        mockGetConnectedProvider.mockResolvedValue({ request: providerRequest })
      })

      it('should hand the relay a provider that refuses to act for the other account', async () => {
        renderRequestPage()
        await approveActionRequest()
        await waitFor(() => expect(sendMetaTransaction).toHaveBeenCalledTimes(1))
        const [boundProvider] = jest.mocked(sendMetaTransaction).mock.calls[0] as unknown as [
          { request: (args: unknown) => Promise<unknown> }
        ]
        await expect(boundProvider.request({ method: 'eth_requestAccounts', params: [] })).rejects.toBeInstanceOf(
          ReviewedSignerMismatchError
        )
        await expect(boundProvider.request({ method: 'eth_signTypedData_v4', params: ['0xnewwallet', '{}'] })).rejects.toBeInstanceOf(
          ReviewedSignerMismatchError
        )
      })
    })

    describe('and the relay refuses because the wallet no longer names the reviewing account', () => {
      beforeEach(() => {
        jest.mocked(sendMetaTransaction).mockRejectedValue(new ReviewedSignerMismatchError(SIGNER, '0xnewwallet'))
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should show the account-change view and answer nothing', async () => {
        renderRequestPage()
        await approveActionRequest()
        expect(await screen.findByTestId('different-account')).toBeInTheDocument()
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      })
    })
  })

  describe('when the request is a transaction to a Decentraland contract the wallet sends itself', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(dclTransaction({ relayed: false, chainId: 1, contract: knownContract({ chainId: 1 }) }))
      mockWalletRequest.mockResolvedValue('0xhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should show the generic review on the connected chain', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual(expect.objectContaining({ kind: 'transaction', chainId: 1 }))
    })

    it('should estimate the fee the user pays before Allow enables', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockEstimateGas).toHaveBeenCalledWith({ account: SIGNER, to: CONTRACT, data: '0xabcd', value: BigInt(0) })
    })

    describe('and the fee estimate has not answered yet', () => {
      beforeEach(() => {
        mockEstimateGas.mockReturnValue(new Promise(() => undefined))
      })

      it('should keep Allow blocked after the acknowledgment', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('action-request')
        await userEvent.click(screen.getByTestId('action-acknowledge'))
        await waitFor(() => expect(view).toHaveAttribute('data-acknowledged', 'true'))
        expect(view).toHaveAttribute('data-approve-blocked', 'true')
      })
    })

    it('should send it as a plain transaction on the reviewed chain, never through the relay', async () => {
      renderRequestPage()
      await approveActionRequest()
      await screen.findByTestId('wallet-interaction-complete')
      expect(mockWalletRequest).toHaveBeenCalledWith({
        method: 'eth_sendTransaction',
        params: [{ to: CONTRACT, data: '0xabcd', value: '0x0', from: SIGNER, chainId: '0x1' }]
      })
      expect(sendMetaTransaction).not.toHaveBeenCalled()
    })
  })

  describe('when the request is a MANA tip', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.MAGIC }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      jest.mocked(decodeManaTransferData).mockReturnValue({ manaAmount: '10', toAddress: '0xrecipient' })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: '0xmanacontract', data: '0xa9059cbb', value: '0x0' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(
        dclTransaction({
          to: '0xmanacontract',
          data: '0xa9059cbb',
          branded: 'tip',
          call: { functionName: 'transfer', args: ['0xrecipient', BigInt(10)], payable: false, forwardsCall: false }
        })
      )
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    afterEach(() => {
      jest.mocked(decodeManaTransferData).mockReturnValue(null)
    })

    it('should show the donation transfer view', async () => {
      renderRequestPage()
      expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
    })

    it('should run the same counterparty check as the generic review', async () => {
      renderRequestPage()
      await screen.findByTestId('transfer-confirm')
      expect(mockGetCounterpartyAddresses).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'transfer' }), 137)
    })

    describe('and the check finds the call reaches a contract that is not Decentraland', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: ['0xother'], opaque: false })
        mockIsAddressWithoutCode.mockResolvedValue(false)
        mockIsDecentralandCollection.mockResolvedValue(false)
        mockSendFailedOutcome.mockResolvedValue({})
      })

      it('should fall back to the generic review, which shows the payload whole, instead of the tip screen', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('action-request')).toBeInTheDocument()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      })

      it('should still let the transfer be relayed from the generic review once acknowledged', async () => {
        renderRequestPage()
        await approveActionRequest()
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
        await screen.findByTestId('wallet-interaction-complete')
        expect(sendMetaTransaction).toHaveBeenCalledTimes(1)
      })
    })

    describe('and the check itself fails', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockImplementation(() => {
          throw new Error('unexpected')
        })
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
      })

      afterEach(() => {
        jest.mocked(console.error).mockRestore()
      })

      it('should fall back to the generic review rather than refuse or leave nothing on screen', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('action-request')).toBeInTheDocument()
        expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
      })
    })

    it('should ask a web2 user to confirm once more before relaying', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('transfer-confirm-approve'))
      expect(await screen.findByTestId('confirm-request-dialog')).toHaveAttribute('data-gas-covered', 'true')
      expect(sendMetaTransaction).not.toHaveBeenCalled()
      await userEvent.click(screen.getByTestId('confirm-request-confirm'))
      await screen.findByTestId('transfer-completed')
      expect(sendMetaTransaction).toHaveBeenCalledTimes(1)
    })

    describe('and notification delivery is still pending after success', () => {
      let user: ReturnType<typeof userEvent.setup>
      let rejectNotification: (error: Error) => void

      beforeEach(() => {
        jest.useFakeTimers()
        user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
        mockRecover.mockResolvedValue({
          ...recovered('eth_sendTransaction', [{ to: '0xmanacontract', data: '0xa9059cbb', value: '0x0' }]),
          expiration: new Date(Date.now() + 60_000).toISOString()
        })
        jest.mocked(sendTipNotification).mockReturnValueOnce(
          new Promise<void>((_resolve, reject) => {
            rejectNotification = reject
          })
        )
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it('should show completion immediately and keep it past the request expiry', async () => {
        renderRequestPage()
        await user.click(await screen.findByTestId('transfer-confirm-approve'))
        expect(await screen.findByTestId('transfer-completed')).toBeInTheDocument()
        expect(sendTipNotification).toHaveBeenCalledTimes(1)
        act(() => jest.advanceTimersByTime(61_000))
        expect(screen.getByTestId('transfer-completed')).toBeInTheDocument()
        expect(screen.queryByTestId('timeout-error')).not.toBeInTheDocument()
      })

      it('should preserve success if the notification later rejects', async () => {
        renderRequestPage()
        await user.click(await screen.findByTestId('transfer-confirm-approve'))
        await screen.findByTestId('transfer-completed')
        await act(async () => rejectNotification(new Error('Notification unavailable')))
        expect(screen.getByTestId('transfer-completed')).toBeInTheDocument()
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      })
    })

    describe('and the recipient lookups fail', () => {
      beforeEach(() => {
        jest.mocked(fetchProfile).mockRejectedValue(new Error('catalyst down'))
      })

      afterEach(() => {
        jest.mocked(fetchProfile).mockReset()
      })

      it('should fall back to the generic review instead of a bare confirmation', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('action-request')).toBeInTheDocument()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })
    })
  })

  describe('when the request is a transfer on a verified Decentraland collection', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: COLLECTION, data: '0x23b872dd', value: '0x0' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(
        dclTransaction({
          to: COLLECTION,
          data: '0x23b872dd',
          branded: 'gift_candidate',
          contract: knownContract({
            name: 'ERC721CollectionV2',
            address: COLLECTION,
            domainName: 'Decentraland Collection',
            domainVersion: '2'
          }),
          call: { functionName: 'safeTransferFrom', args: [SIGNER, '0xrecipient', BigInt(1)], payable: false, forwardsCall: false }
        })
      )
      jest.mocked(decodeNftTransferData).mockReturnValue({ fromAddress: SIGNER, tokenId: '1', toAddress: '0xrecipient' })
      jest.mocked(fetchProfile).mockResolvedValue(null)
      jest.mocked(fetchNftMetadata).mockResolvedValue({ imageUrl: 'x', tokenId: '1', name: 'n', description: 'd', rarity: 'common' } as any)
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      mockSendFailedOutcome.mockResolvedValue({})
    })

    afterEach(() => {
      jest.mocked(decodeNftTransferData).mockReturnValue(null)
      jest.mocked(fetchNftMetadata).mockReset()
      jest.mocked(fetchProfile).mockReset()
    })

    it('should show the branded gift confirmation view', async () => {
      renderRequestPage()
      expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
    })

    it('should describe the transfer the decoded call carries', async () => {
      renderRequestPage()
      await screen.findByTestId('transfer-confirm')

      expect(jest.mocked(decodeNftTransferData)).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'safeTransferFrom' }))
      expect(jest.mocked(fetchNftMetadata)).toHaveBeenCalledWith(COLLECTION, expect.anything(), '1')
    })

    describe("and the token being transferred is not the signer's", () => {
      beforeEach(() => {
        jest.mocked(decodeNftTransferData).mockReturnValue({ fromAddress: '0xsomeoneelse', tokenId: '1', toAddress: '0xrecipient' })
      })

      it('should stay on the generic review, whose payload says whose token it is', async () => {
        renderRequestPage()
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(fetchNftMetadata).not.toHaveBeenCalled()
        expect(mockGetCounterpartyAddresses).not.toHaveBeenCalled()
      })
    })

    describe('and the call is not a plain transfer of one token', () => {
      beforeEach(() => {
        jest.mocked(decodeNftTransferData).mockReturnValue(null)
      })

      it('should stay on the generic review instead of the branded gift view', async () => {
        renderRequestPage()
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(fetchNftMetadata).not.toHaveBeenCalled()
      })
    })

    describe('and the recipient is a contract that is not Decentraland', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: ['0xrecipient'], opaque: false })
        mockIsAddressWithoutCode.mockResolvedValue(false)
        mockIsDecentralandCollection.mockResolvedValue(false)
      })

      it('should stay on the generic review, which shows the payload whole, instead of the gift screen', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        await waitFor(() => expect(mockIsDecentralandCollection).toHaveBeenCalledWith('0xrecipient'))
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
        expect(fetchNftMetadata).not.toHaveBeenCalled()
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
      })

      it('should judge the recipient code on the chain the transfer executes on, cheapest check first', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        await waitFor(() => expect(mockIsDecentralandCollection).toHaveBeenCalledWith('0xrecipient'))
        expect(mockIsAddressWithoutCode).toHaveBeenCalledWith('0xrecipient', 137)
      })
    })

    describe('and the recipient code could not be checked', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: ['0xrecipient'], opaque: false })
        mockIsAddressWithoutCode.mockRejectedValue(new Error('RPC unavailable'))
      })

      it('should treat the recipient as code Decentraland cannot vouch for and stay on the generic review', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        await waitFor(() => expect(mockIsAddressWithoutCode).toHaveBeenCalledWith('0xrecipient', 137))
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(fetchNftMetadata).not.toHaveBeenCalled()
      })
    })

    describe('and the transfer carries a nested payload that could not be read', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: [], opaque: true })
      })

      it('should stay on the generic review without asking the network', async () => {
        renderRequestPage()
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(mockIsAddressWithoutCode).not.toHaveBeenCalled()
        expect(fetchNftMetadata).not.toHaveBeenCalled()
      })
    })

    describe('and reading what the transfer reaches fails unexpectedly', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockImplementation(() => {
          throw new Error('unexpected')
        })
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
      })

      afterEach(() => {
        jest.mocked(console.error).mockRestore()
      })

      it('should stay on the generic review rather than refuse or leave Allow blocked on a check that never settles', async () => {
        renderRequestPage()
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
        expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
      })
    })

    describe('and the recipient is a Decentraland collection', () => {
      beforeEach(() => {
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: ['0xrecipient'], opaque: false })
        mockIsAddressWithoutCode.mockResolvedValue(false)
        mockIsDecentralandCollection.mockResolvedValue(true)
      })

      it('should show the gift screen, since the code that runs is Decentraland code', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
      })
    })

    describe('and the transfer is a transferFrom, which does not call its recipient', () => {
      beforeEach(() => {
        const call = { functionName: 'transferFrom', args: [SIGNER, '0xrecipient', BigInt(1)], payable: false, forwardsCall: false }
        const { addresses, opaque } = collectCallAddresses(call, 137)
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: [...addresses], opaque })
      })

      it('should show the gift screen without asking the network or warning about the recipient', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('transfer-confirm')
        await waitFor(() => expect(view).toHaveAttribute('data-approve-blocked', 'false'))
        expect(view).toHaveAttribute('data-callbacks', '[]')
        expect(mockIsAddressWithoutCode).not.toHaveBeenCalled()
      })
    })

    describe('and the recipient has no code during the review', () => {
      let view: HTMLElement

      beforeEach(async () => {
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: ['0xrecipient'], opaque: false })
        mockIsAddressWithoutCode.mockResolvedValue(true)
        renderRequestPage()
        view = await screen.findByTestId('transfer-confirm')
      })

      it('should carry the mutable callback into the branded review', () => {
        expect(view).toHaveAttribute('data-callbacks', '["0xrecipient"]')
      })

      it('should block approval until the callback risk is acknowledged', () => {
        expect(view).toHaveAttribute('data-approve-blocked', 'true')
      })

      it('should enable approval after the callback risk is acknowledged', async () => {
        await userEvent.click(screen.getByTestId('callback-acknowledge'))
        await waitFor(() => expect(view).toHaveAttribute('data-approve-blocked', 'false'))
      })
    })

    it('should hand the branded screen the chain, so the recipient can be looked up on the explorer', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('transfer-confirm')

      await waitFor(() => expect(view).toHaveAttribute('data-chain', '137'))
    })

    it('should relay the transfer through the collection on approval', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('transfer-confirm-approve'))
      await screen.findByTestId('transfer-completed')
      expect(sendMetaTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        '0x23b872dd',
        expect.objectContaining({ address: COLLECTION, name: 'Decentraland Collection', version: '2', chainId: 137 }),
        expect.anything()
      )
    })

    describe('and the counterparty check is still running', () => {
      let settleCodeRead: (hasNoCode: boolean) => void

      beforeEach(() => {
        settleCodeRead = () => undefined
        mockGetCounterpartyAddresses.mockReturnValue({ addresses: ['0xrecipient'], opaque: false })
        mockIsAddressWithoutCode.mockReturnValue(new Promise<boolean>(resolve => (settleCodeRead = resolve)))
      })

      it('should show the generic review, a tick away from Allow, rather than the branded view or a bare spinner', async () => {
        renderRequestPage()
        await clearActionRequestGates()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })

      it('should upgrade to the branded view only once the check has passed', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        expect(fetchNftMetadata).not.toHaveBeenCalled()
        settleCodeRead(true)
        expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
      })

      it('should keep a denial given before the check passed', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('action-deny'))
        await screen.findByTestId('denied-wallet-interaction')
        settleCodeRead(true)
        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
        expect(fetchNftMetadata).not.toHaveBeenCalled()
        expect(screen.getByTestId('denied-wallet-interaction')).toBeInTheDocument()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })
    })

    describe('and the token metadata cannot be fetched', () => {
      beforeEach(() => {
        jest.mocked(fetchNftMetadata).mockRejectedValueOnce(new Error('tokenURI reverted'))
      })

      it('should fall through to the generic review instead of the branded gift view', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('action-request')).toBeInTheDocument()
        await waitFor(() => expect(fetchNftMetadata).toHaveBeenCalledTimes(1))
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })

      it('should still let the transfer be approved from the generic review', async () => {
        renderRequestPage()
        await screen.findByTestId('action-request')
        await waitFor(() => expect(fetchNftMetadata).toHaveBeenCalledTimes(1))
        await approveActionRequest()
        await waitFor(() => expect(sendMetaTransaction).toHaveBeenCalledTimes(1))
      })
    })
  })

  describe('when a transfer decodes on a Decentraland contract that is not a collection', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0x23b872dd', value: '0x0' }]))
      mockGetAddresses.mockResolvedValue([SIGNER])
      // An ERC-20 transferFrom shares the ERC-721 selector; the classifier leaves it unbranded.
      mockClassifyRequest.mockResolvedValue(
        dclTransaction({
          data: '0x23b872dd',
          branded: null,
          call: { functionName: 'transferFrom', args: [SIGNER, '0xrecipient', BigInt(1)], payable: false, forwardsCall: false }
        })
      )
    })

    it('should show the generic review instead of the branded gift view', async () => {
      renderRequestPage()
      expect(await screen.findByTestId('action-request')).toBeInTheDocument()
      expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
    })

    it('should not fetch token metadata from it', async () => {
      renderRequestPage()
      await screen.findByTestId('action-request')
      expect(fetchNftMetadata).not.toHaveBeenCalled()
    })
  })

  describe('when the request is a MetaTransaction signature for a Decentraland contract', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"MetaTransaction"}']))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(dclMetaTransaction())
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should show the generic review with the typed data exactly as the wallet will read it', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(view).toHaveAttribute('data-payload', JSON.stringify({ kind: 'typed_data', raw: '{"primaryType":"MetaTransaction"}' }))
    })

    it('should ask for the acknowledgment like any other request, and sign nothing before it is given', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(view).toHaveAttribute('data-approve-blocked', 'true')
      await userEvent.click(screen.getByTestId('action-approve'))
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    it('should enable Allow on the acknowledgment alone, since a signature costs no fee', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockEstimateGas).not.toHaveBeenCalled()
    })

    it('should not check the contracts the inner call reaches, since nothing is vouched for on this screen', async () => {
      renderRequestPage()
      await clearActionRequestGates()
      expect(mockGetCounterpartyAddresses).not.toHaveBeenCalled()
      expect(mockIsAddressWithoutCode).not.toHaveBeenCalled()
    })

    it('should hand the wallet the signer and the typed data on approval', async () => {
      renderRequestPage()
      await approveActionRequest()
      await waitFor(() =>
        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_signTypedData_v4',
          params: [SIGNER, '{"primaryType":"MetaTransaction"}']
        })
      )
    })
  })

  describe('when the request id changes while the page stays mounted', () => {
    let otherRequestId: string
    let NavigateToOther: () => JSX.Element
    let renderMountedPage: () => ReturnType<typeof render>

    beforeEach(() => {
      otherRequestId = 'other-request-456'
      NavigateToOther = () => {
        const navigate = useNavigate()
        return (
          <>
            <button data-testid="go-to-other" onClick={() => navigate(`/auth/requests/${otherRequestId}?targetConfigId=default`)}>
              other
            </button>
            <button data-testid="go-to-first" onClick={() => navigate(`/auth/requests/${REQUEST_ID}?targetConfigId=default`)}>
              first
            </button>
          </>
        )
      }
      renderMountedPage = () =>
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
      // These tests queue one-shot values; clearAllMocks does not drain unused queues, so start clean.
      mockRecover.mockReset()
      mockGetCounterpartyAddresses.mockReset()
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      // The acknowledgment is given to the first request only, so any actionable review seen after the
      // change can only be stale: the new one asks for its own.
    })

    afterEach(() => {
      mockRecover.mockReset()
      mockGetCounterpartyAddresses.mockReset()
    })

    // A dispatch belongs to the request it was given to. Another request has its own outcome to deliver and
    // cannot be double-answered by it, so it must be reviewable on its own terms; and whatever review of the
    // dispatching request is on screen is busy, not dead, and is released when the wallet answers.
    describe('and a wallet call for the previous request is still unresolved', () => {
      let releaseRelay: (hash: string) => void

      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
        releaseRelay = () => undefined
        jest
          .mocked(sendMetaTransaction)
          .mockReset()
          .mockImplementationOnce(() => new Promise(resolve => (releaseRelay = resolve)))
        mockSendFailedOutcome.mockReset().mockResolvedValue({})
      })

      it('should leave the new request fully reviewable, and answer it under its own id', async () => {
        renderMountedPage()
        await approveActionRequest()
        await waitFor(() => expect(jest.mocked(sendMetaTransaction)).toHaveBeenCalledTimes(1))

        await userEvent.click(screen.getByTestId('go-to-other'))
        await screen.findByTestId('action-request')
        await waitFor(() => expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true))

        await userEvent.click(screen.getByTestId('action-deny'))

        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
        expect(mockSendFailedOutcome).toHaveBeenCalledWith(otherRequestId, SIGNER, { code: -32003, message: 'Transaction rejected' })
        releaseRelay('0xhash')
      })

      it('should release a review of the dispatching request once the wallet answers, rather than leave it busy', async () => {
        renderMountedPage()
        await approveActionRequest()
        await waitFor(() => expect(jest.mocked(sendMetaTransaction)).toHaveBeenCalledTimes(1))

        // Away and back again, in the same page: the request is still with the wallet, so its review is busy.
        await userEvent.click(screen.getByTestId('go-to-other'))
        await screen.findByTestId('action-request')
        await userEvent.click(screen.getByTestId('go-to-first'))
        const returned = await screen.findByTestId('action-request')
        await userEvent.click(screen.getByTestId('action-acknowledge'))
        expect(returned).toHaveAttribute('data-approve-blocked', 'true')

        mockSendSuccessfulOutcome.mockResolvedValue({})
        await act(async () => {
          releaseRelay('0xhash')
        })

        // The wallet answered, so nothing is held on its account any more.
        await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-approve-blocked', 'false'))
      })
    })

    describe('and Deny is still waiting for its outcome to be delivered when the id changes', () => {
      let deliverOutcome: () => void

      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
        mockSendFailedOutcome.mockReset()
        mockSendFailedOutcome
          .mockImplementationOnce(() => new Promise<Record<string, never>>(resolve => (deliverOutcome = () => resolve({}))))
          .mockResolvedValue({})
      })

      it('should leave the new review on screen and answerable, never showing the old denial', async () => {
        renderMountedPage()
        await screen.findByTestId('action-request')
        await userEvent.click(screen.getByTestId('action-deny'))
        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
        await userEvent.click(screen.getByTestId('go-to-other'))
        const fresh = await screen.findByTestId('action-request')
        await waitFor(() => expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true))

        deliverOutcome()

        await waitFor(() => expect(fresh).toHaveAttribute('data-approve-blocked', 'true'))
        expect(screen.queryByTestId('denied-wallet-interaction')).not.toBeInTheDocument()
        await userEvent.click(screen.getByTestId('action-deny'))
        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(2))
        expect(mockSendFailedOutcome.mock.calls[1][0]).toBe(otherRequestId)
      })
    })

    describe('and Allow is still waiting for the wallet when the id changes', () => {
      let settleRelay: () => void

      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
        jest
          .mocked(sendMetaTransaction)
          .mockImplementationOnce(() => new Promise<string>(resolve => (settleRelay = () => resolve('0xrelayedhash'))))
      })

      it('should still deliver the executed outcome for the old request but never show its completion over the new review', async () => {
        renderMountedPage()
        await approveActionRequest()
        await waitFor(() => expect(sendMetaTransaction).toHaveBeenCalledTimes(1))
        await userEvent.click(screen.getByTestId('go-to-other'))
        const fresh = await screen.findByTestId('action-request')
        await waitFor(() => expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true))

        settleRelay()

        await waitFor(() => expect(mockSendSuccessfulOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, '0xrelayedhash'))
        expect(screen.queryByTestId('wallet-interaction-complete')).not.toBeInTheDocument()
        expect(fresh).toBeInTheDocument()
        expect(fresh).toHaveAttribute('data-approve-blocked', 'true')
      })
    })

    describe('and the new request is recovered normally', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      })

      it('should recover the new request and review it from scratch instead of reusing the old acknowledgment', async () => {
        renderMountedPage()
        await clearActionRequestGates()
        await userEvent.click(screen.getByTestId('go-to-other'))
        const fresh = await screen.findByTestId('action-request')
        expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true)
        expect(fresh).toHaveAttribute('data-acknowledged', 'false')
        expect(fresh).toHaveAttribute('data-approve-blocked', 'true')
      })

      it('should recover the new request exactly once, after its own profile check', async () => {
        renderMountedPage()
        await clearActionRequestGates()
        await userEvent.click(screen.getByTestId('go-to-other'))
        // The profile check re-runs for the new id; a duplicate load would fire around its completion.
        await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalledTimes(2))
        await screen.findByTestId('action-request')
        await waitFor(() => expect(mockRecover.mock.calls.filter(call => call[0] === otherRequestId)).toHaveLength(1))
        expect(mockRecover.mock.calls.filter(call => call[0] === REQUEST_ID)).toHaveLength(1)
        expect(mockRecover).toHaveBeenCalledTimes(2)
      })

      it('should load the new request even though the previous one was completed', async () => {
        renderMountedPage()
        await approveActionRequest()
        await screen.findByTestId('wallet-interaction-complete')
        await userEvent.click(screen.getByTestId('go-to-other'))
        await waitFor(() => expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true))
        expect(screen.queryByTestId('wallet-interaction-complete')).not.toBeInTheDocument()
      })
    })

    describe("and the new request's recovery is held", () => {
      beforeEach(() => {
        // The first recovery resolves; the second is held so the state between the change and the new
        // review is observable.
        mockRecover
          .mockResolvedValueOnce(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
          .mockImplementation(() => new Promise(() => undefined))
      })

      it('should drop the previous review and show the loading view before anything of the new request', async () => {
        renderMountedPage()
        await clearActionRequestGates()
        await userEvent.click(screen.getByTestId('go-to-other'))
        expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
        expect(screen.queryByTestId('action-request')).not.toBeInTheDocument()
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
              approvalUiAtCommit.push(screen.queryByTestId('action-approve') !== null)
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
          await clearActionRequestGates()
          expect(screen.getByTestId('action-approve')).toBeInTheDocument()
          const commitsBefore = approvalUiAtCommit.length
          await userEvent.click(screen.getByTestId('go-to-other'))
          expect(approvalUiAtCommit.length).toBeGreaterThan(commitsBefore)
          expect(approvalUiAtCommit.slice(commitsBefore).some(present => present)).toBe(false)
        })
      })
    })
  })
  describe('when a load runs again for the same request and account', () => {
    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.THIRDWEB }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    // An embedded wallet handing the app a fresh provider object for the same account. The reset keyed to
    // the request and the account does not run for it, but the load does: it recovers, reclassifies and
    // re-reviews, so nothing the previous run derived still describes what is on screen.
    const refreshTheProvider = (rerender: (ui: React.ReactElement) => void) => {
      mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
      rerenderRequestPage(rerender)
    }

    // A transaction the user pays gas for: its fee estimate is the one gate a replacement review has to
    // settle again, so holding the second estimate leaves the replacement demonstrably unfinished.
    describe('and the user had already opened the web2 confirmation', () => {
      beforeEach(() => {
        mockClassifyRequest.mockResolvedValue(dclTransaction({ relayed: false, chainId: 1, contract: knownContract({ chainId: 1 }) }))
        mockWalletRequest.mockResolvedValue('0xhash')
        mockEstimateGas.mockResolvedValueOnce(BigInt(21000)).mockImplementation(() => new Promise(() => undefined))
      })

      it('should close the confirmation, since it was opened against a review that no longer stands', async () => {
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()
        await userEvent.click(screen.getByTestId('action-approve'))
        expect(await screen.findByTestId('confirm-request-dialog')).toBeInTheDocument()

        refreshTheProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))

        await waitFor(() => expect(screen.queryByTestId('confirm-request-dialog')).not.toBeInTheDocument())
      })

      it('should send nothing even if the confirmation is confirmed anyway', async () => {
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()
        await userEvent.click(screen.getByTestId('action-approve'))
        await screen.findByTestId('confirm-request-dialog')

        refreshTheProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
        // The confirmation should be gone; if it is not, its Confirm reaches the same handler, and the
        // handler is what must refuse. Allow itself is pressed raw either way, because the double's button
        // is not disabled: both paths end at the handler, which enforces gates that no longer hold.
        const confirm = screen.queryByTestId('confirm-request-confirm')
        if (confirm) {
          await userEvent.click(confirm)
        }
        await userEvent.click(screen.getByTestId('action-approve'))

        expect(mockWalletRequest).not.toHaveBeenCalled()
      })

      it('should put the review back to deciding rather than leave the settled verdict on screen', async () => {
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()

        refreshTheProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))

        const replacement = await screen.findByTestId('action-request')
        expect(replacement).toHaveAttribute('data-approve-blocked', 'true')
      })
    })

    describe('and the replacement fee estimate has not answered', () => {
      beforeEach(() => {
        mockClassifyRequest.mockResolvedValue(dclTransaction({ relayed: false, chainId: 1, contract: knownContract({ chainId: 1 }) }))
        mockWalletRequest.mockResolvedValue('0xhash')
        mockEstimateGas.mockResolvedValueOnce(BigInt(21000)).mockImplementation(() => new Promise(() => undefined))
      })

      it('should block Allow rather than carry the previous review over', async () => {
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()

        refreshTheProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))

        const replacement = await screen.findByTestId('action-request')
        expect(replacement).toHaveAttribute('data-approve-blocked', 'true')
      })

      it('should send nothing if Allow is pressed anyway', async () => {
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()

        refreshTheProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
        await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-approve-blocked', 'true'))

        // Pressed raw on purpose: the double's button is not disabled, so this is the press the handler
        // itself has to refuse.
        await userEvent.click(screen.getByTestId('action-approve'))

        expect(mockWalletRequest).not.toHaveBeenCalled()
      })
    })

    // The replacement is committed before anything invalidates it: React renders and paints the page with
    // the new provider, and the load that re-recovers, reclassifies and re-reviews is a passive effect
    // that only runs afterwards. On that commit the previous review is still on screen under a provider
    // the page has already replaced, so the page has to refuse it there — during the render — rather than
    // leave it to the effect that follows.
    describe('and the replacement is observed commit by commit', () => {
      let approveBlockedAtCommit: string[]
      let pressOnNextCommit: 'action-approve' | 'action-deny' | null
      let walletReadFromPress: boolean
      let CommitProbe: ({ children }: { children: React.ReactNode }) => JSX.Element

      beforeEach(() => {
        // Injected, so Allow dispatches from the press instead of opening the web2 confirmation first.
        mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
        approveBlockedAtCommit = []
        pressOnNextCommit = null
        walletReadFromPress = false
        // A layout effect runs in the same commit as the DOM update and before every passive effect, so it
        // sees the page exactly as the user would on that render — and can press what the user could press.
        CommitProbe = ({ children }: { children: React.ReactNode }) => {
          useLayoutEffect(() => {
            const view = screen.queryByTestId('action-request')
            approveBlockedAtCommit.push(view?.getAttribute('data-approve-blocked') ?? 'no-review')
            if (pressOnNextCommit) {
              const pressed = pressOnNextCommit
              pressOnNextCommit = null
              // The double's buttons are never disabled, so the press reaches the page's handler either way:
              // whether it goes ahead is the page's own answer, which is what this measures. Both handlers
              // read the wallet before anything else, so a read means it did.
              const walletReadsBefore = mockGetAddresses.mock.calls.length
              screen.queryByTestId(pressed)?.click()
              walletReadFromPress = mockGetAddresses.mock.calls.length > walletReadsBefore
            }
          })
          return <>{children}</>
        }
      })

      const probedPage = () => (
        <MemoryRouter initialEntries={[`/auth/requests/${REQUEST_ID}?targetConfigId=default`]}>
          <FeatureFlagsContext.Provider value={{ flags: mockFlags as any, variants: {} as any, initialized: mockFlagsInitialized }}>
            <Routes>
              <Route
                path="/auth/requests/:requestId"
                element={
                  <CommitProbe>
                    <RequestPage />
                  </CommitProbe>
                }
              />
            </Routes>
          </FeatureFlagsContext.Provider>
        </MemoryRouter>
      )

      // A fresh tree, since re-rendering the same element bails out before the probe could record.
      const refreshTheProbedProvider = (rerender: (ui: React.ReactElement) => void) => {
        mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
        rerender(probedPage())
      }

      it('should block Allow on the very commit the provider is replaced, before any effect runs', async () => {
        const { rerender } = render(probedPage())
        await clearActionRequestGates()

        const commitsBefore = approveBlockedAtCommit.length
        refreshTheProbedProvider(rerender)

        expect(approveBlockedAtCommit.length).toBeGreaterThan(commitsBefore)
        expect(approveBlockedAtCommit.slice(commitsBefore)).not.toContain('false')
      })

      it('should relay nothing if Allow is pressed on that commit', async () => {
        const { rerender } = render(probedPage())
        await clearActionRequestGates()

        pressOnNextCommit = 'action-approve'
        refreshTheProbedProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))

        // Refused by the page, not by a guard that happened to be re-read after the load had run: the
        // press must not reach the wallet at all.
        expect(walletReadFromPress).toBe(false)
        expect(jest.mocked(sendMetaTransaction)).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      })

      it('should answer nothing if Deny is pressed on that commit, and still redo the review', async () => {
        const { rerender } = render(probedPage())
        await clearActionRequestGates()

        pressOnNextCommit = 'action-deny'
        refreshTheProbedProvider(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))

        // Deny would have answered through the clients of the provider the page had just replaced. It is
        // refused before it reads anything — and before it marks the request answered, so the load that
        // follows is not told the request is settled and the replacement review comes up as it should.
        expect(walletReadFromPress).toBe(false)
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        // The replacement asks about the same request, payload and notices, so the tick already given
        // counts for it once it is up (see useAcknowledgment).
        await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-approve-blocked', 'false'))
        expect(screen.queryByTestId('denied-wallet-interaction')).not.toBeInTheDocument()
      })

      it('should still deliver a Deny that was in flight when the provider was replaced', async () => {
        // The review reads the account once; Deny's read is held until the replacement has been committed.
        let releaseAccountRead: (addresses: string[]) => void = () => undefined
        mockGetAddresses
          .mockResolvedValueOnce([SIGNER])
          .mockImplementationOnce(() => new Promise(resolve => (releaseAccountRead = resolve)))
        const { rerender } = render(probedPage())
        await clearActionRequestGates()

        await userEvent.click(screen.getByTestId('action-deny'))
        await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
        refreshTheProbedProvider(rerender)
        releaseAccountRead([SIGNER])

        // The decision was made — on this request, by this account, through the wallet that was current
        // when it was made; only the provider object has moved since. It stands: Deny marked the request
        // answered when it was pressed, so the load that ran meanwhile left the review alone, and backing
        // out now would leave nothing to redo it.
        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
        expect(await screen.findByTestId('denied-wallet-interaction')).toBeInTheDocument()
      })
    })
  })

  describe('when the request expires while Allow is still preparing', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      // Far enough out that the review settles, close enough to fire while the account read is held.
      mockRecover.mockResolvedValue({
        method: 'eth_sendTransaction',
        params: [{ to: CONTRACT, data: '0xabcd', value: '0x0' }],
        sender: SIGNER,
        expiration: new Date(Date.now() + 400).toISOString()
      })
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should relay nothing once the timeout screen has taken over', async () => {
      // The review reads the account once; Allow's read is held until the expiry has fired. Expiry settles
      // the request and shows the timeout screen without moving the review generation, so the handler has
      // to re-read the terminal state itself rather than rely on staleness.
      let releaseAccountRead: (addresses: string[]) => void = () => undefined
      mockGetAddresses.mockResolvedValueOnce([SIGNER]).mockImplementationOnce(() => new Promise(resolve => (releaseAccountRead = resolve)))

      renderRequestPage()
      await clearActionRequestGates()

      await userEvent.click(screen.getByTestId('action-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(await screen.findByTestId('timeout-error')).toBeInTheDocument()

      releaseAccountRead([SIGNER])

      await waitFor(() => expect(jest.mocked(sendMetaTransaction)).not.toHaveBeenCalled())
      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
    })
  })

  describe('when the acknowledgment the review asks for is given', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should block Allow until it is given', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')

      expect(view).toHaveAttribute('data-acknowledged', 'false')
      expect(view).toHaveAttribute('data-approve-blocked', 'true')
    })

    it('should enable Allow once given for the screen on display', async () => {
      renderRequestPage()
      await screen.findByTestId('action-request')

      await userEvent.click(screen.getByTestId('action-acknowledge'))

      await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-acknowledged', 'true'))
      await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-approve-blocked', 'false'))
    })

    it('should relay nothing if Allow is pressed before it is given', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('action-request')
      expect(view).toHaveAttribute('data-approve-blocked', 'true')

      // Pressed raw on purpose: the double's button is not disabled, so this is the press the handler
      // itself has to refuse.
      await userEvent.click(screen.getByTestId('action-approve'))

      expect(jest.mocked(sendMetaTransaction)).not.toHaveBeenCalled()
    })

    // A gift whose lookups fail stays on the generic review, and its counterparty check is the one thing
    // that can add a notice to that screen — a callback address with no code — between two reviews of the
    // same request.
    describe('and the same request is reviewed again and asks about something else', () => {
      beforeEach(() => {
        mockClassifyRequest.mockResolvedValue(
          dclTransaction({
            to: COLLECTION,
            branded: 'gift_candidate',
            contract: knownContract({ name: 'ERC721CollectionV2', address: COLLECTION }),
            call: { functionName: 'safeTransferFrom', args: [SIGNER, '0xempty', BigInt(1)], payable: false, forwardsCall: false }
          })
        )
        jest.mocked(decodeNftTransferData).mockReturnValue({ fromAddress: SIGNER, tokenId: '1', toAddress: '0xempty' })
        jest.mocked(fetchNftMetadata).mockRejectedValue(new Error('tokenURI reverted'))
        jest.spyOn(console, 'error').mockImplementation(() => undefined)
        // The first review reaches nothing; the replacement finds the recipient has no code yet.
        mockGetCounterpartyAddresses
          .mockReturnValueOnce({ addresses: [], opaque: false })
          .mockReturnValue({ addresses: ['0xempty'], opaque: false })
        mockIsAddressWithoutCode.mockResolvedValue(true)
      })

      afterEach(() => {
        jest.mocked(decodeNftTransferData).mockReturnValue(null)
        jest.mocked(fetchNftMetadata).mockReset()
        jest.mocked(console.error).mockRestore()
      })

      it('should stop counting the acknowledgment and ask again', async () => {
        const { rerender } = renderRequestPage()
        await screen.findByTestId('action-request')
        await waitFor(() => expect(fetchNftMetadata).toHaveBeenCalledTimes(1))
        await clearActionRequestGates()

        mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
        rerenderRequestPage(rerender)

        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
        await waitFor(() => expect(mockIsAddressWithoutCode).toHaveBeenCalledWith('0xempty', 137))
        const replacement = await screen.findByTestId('action-request')
        await waitFor(() => expect(replacement).toHaveAttribute('data-acknowledged', 'false'))
        expect(replacement).toHaveAttribute('data-approve-blocked', 'true')
      })
    })
  })

  describe('when Allow is already in flight and the provider is replaced for the same account', () => {
    let releaseAccountRead: (addresses: string[]) => void

    beforeEach(() => {
      mockConnectionData = { ...mockConnectionData, providerType: ProviderType.INJECTED }
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      // The review's own read resolves; Allow's is held so the reload can finish underneath it.
      releaseAccountRead = () => undefined
      mockGetAddresses
        .mockResolvedValueOnce([SIGNER])
        .mockImplementationOnce(() => new Promise(resolve => (releaseAccountRead = resolve)))
        .mockResolvedValue([SIGNER])
    })

    it('should not deliver an outcome for it either', async () => {
      const { rerender } = renderRequestPage()
      await clearActionRequestGates()
      await userEvent.click(screen.getByTestId('action-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))

      mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
      rerenderRequestPage(rerender)
      await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
      await screen.findByTestId('action-request')

      releaseAccountRead([SIGNER])

      await waitFor(() => expect(mockGetAddresses.mock.calls.length).toBeGreaterThanOrEqual(3))
      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should not dispatch the replacement review with the click that was given to the previous one', async () => {
      const { rerender } = renderRequestPage()
      await clearActionRequestGates()

      // Allow is pressed against the review on screen and stops at its first await.
      await userEvent.click(screen.getByTestId('action-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))

      // The wallet hands the app a new provider for the same account; the replacement review comes up.
      mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
      rerenderRequestPage(rerender)
      await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
      await screen.findByTestId('action-request')

      // Only now does the held read resolve. The consent was given to a review that no longer stands.
      releaseAccountRead([SIGNER])

      await waitFor(() => expect(mockGetAddresses.mock.calls.length).toBeGreaterThanOrEqual(3))
      expect(jest.mocked(sendMetaTransaction)).not.toHaveBeenCalled()
      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
    })

    // The old Allow is parked on a wallet the app has discarded, and that wallet may never answer. The
    // settle lock it took belongs to its review run, so the replacement review must not stay wedged
    // behind it: both of its buttons have to work without the held read ever resolving.
    describe('and the wallet the previous Allow is waiting on never answers', () => {
      let replacement: HTMLElement

      beforeEach(async () => {
        mockSendFailedOutcome.mockResolvedValue({})
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()
        await userEvent.click(screen.getByTestId('action-approve'))
        await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))

        mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
        rerenderRequestPage(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
        replacement = await screen.findByTestId('action-request')
      })

      it('should render the replacement review at rest, not still loading from the previous Allow', async () => {
        await userEvent.click(screen.getByTestId('action-acknowledge'))
        await waitFor(() => expect(replacement).toHaveAttribute('data-approve-blocked', 'false'))
      })

      it('should let the replacement review be denied', async () => {
        await userEvent.click(screen.getByTestId('action-deny'))

        await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
        expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, { code: -32003, message: 'Transaction rejected' })
        expect(await screen.findByTestId('denied-wallet-interaction')).toBeInTheDocument()
      })

      it('should let the replacement review be approved, once, with its own consent', async () => {
        await approveActionRequest()

        await waitFor(() => expect(mockSendSuccessfulOutcome).toHaveBeenCalledTimes(1))
        expect(jest.mocked(sendMetaTransaction)).toHaveBeenCalledTimes(1)
        expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
      })
    })

    // Past the point where the wallet was asked, the transaction may execute whatever the page does next, so
    // the replacement review must not be able to answer the request a second time: it is shown busy until
    // the wallet has spoken, and then the one outcome is delivered and the page completes.
    describe('and the previous Allow had already handed the request to the wallet', () => {
      let releaseRelay: (hash: string) => void
      let replacement: HTMLElement

      beforeEach(async () => {
        mockSendFailedOutcome.mockResolvedValue({})
        mockGetAddresses.mockReset().mockResolvedValue([SIGNER])
        releaseRelay = () => undefined
        jest
          .mocked(sendMetaTransaction)
          .mockReset()
          .mockImplementationOnce(() => new Promise(resolve => (releaseRelay = resolve)))
        const { rerender } = renderRequestPage()
        await approveActionRequest()
        await waitFor(() => expect(jest.mocked(sendMetaTransaction)).toHaveBeenCalledTimes(1))

        mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
        rerenderRequestPage(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
        replacement = await screen.findByTestId('action-request')
      })

      it('should show the replacement review busy and refuse to dispatch or deny again while the wallet has not answered', async () => {
        expect(replacement).toHaveAttribute('data-approve-blocked', 'true')

        await userEvent.click(screen.getByTestId('action-acknowledge'))
        await userEvent.click(screen.getByTestId('action-approve'))
        await userEvent.click(screen.getByTestId('action-deny'))

        expect(replacement).toHaveAttribute('data-approve-blocked', 'true')
        expect(jest.mocked(sendMetaTransaction)).toHaveBeenCalledTimes(1)
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      })

      it('should deliver the one outcome and complete once the wallet answers', async () => {
        await act(async () => {
          releaseRelay('0xrelayedhash')
        })

        await waitFor(() => expect(mockSendSuccessfulOutcome).toHaveBeenCalledTimes(1))
        expect(mockSendSuccessfulOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, '0xrelayedhash')
        expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
        expect(jest.mocked(sendMetaTransaction)).toHaveBeenCalledTimes(1)
      })
    })
  })
  describe('when a request was acknowledged and the provider is replaced for the same account', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockRecover.mockResolvedValue(recovered('personal_sign', ['hello', SIGNER]))
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
    })

    it('should stop counting the acknowledgment and take Allow with it while the replacement is decided', async () => {
      const { rerender } = renderRequestPage()
      await clearActionRequestGates()

      // Hold the replacement recovery so the state between the two reviews is observable.
      mockRecover.mockImplementation(() => new Promise(() => undefined))
      mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
      rerenderRequestPage(rerender)

      // Nothing of the previous review is left on screen to act on.
      expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
      expect(screen.queryByTestId('action-request')).not.toBeInTheDocument()
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    // The two typed-data methods share a classification and a payload, so only the method itself tells a
    // v3 request from a v4 one. The tick was given to one wallet operation; the replacement asks for another.
    describe('and the replacement recovers the same typed data under the other method', () => {
      const TYPED_DATA = '{"primaryType":"Permit"}'

      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v3', [SIGNER, TYPED_DATA]))
      })

      it('should name the method on screen, so the change the tick was dropped for is visible', async () => {
        const { rerender } = renderRequestPage()
        expect(await screen.findByTestId('action-request')).toHaveAttribute('data-method', 'eth_signTypedData_v3')

        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, TYPED_DATA]))
        mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
        rerenderRequestPage(rerender)

        await waitFor(() => expect(screen.getByTestId('action-request')).toHaveAttribute('data-method', 'eth_signTypedData_v4'))
      })

      it('should stop counting the acknowledgment and ask again before signing under the new method', async () => {
        const { rerender } = renderRequestPage()
        await clearActionRequestGates()

        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, TYPED_DATA]))
        mockConnectionData = { ...mockConnectionData, provider: { isMagic: false, refreshed: true } }
        rerenderRequestPage(rerender)
        await waitFor(() => expect(mockRecover.mock.calls.length).toBeGreaterThanOrEqual(2))
        const replacement = await screen.findByTestId('action-request')

        // Same payload on screen, but the earlier tick no longer counts.
        expect(replacement).toHaveAttribute('data-payload', JSON.stringify({ kind: 'typed_data', raw: TYPED_DATA }))
        expect(replacement).toHaveAttribute('data-acknowledged', 'false')
        expect(replacement).toHaveAttribute('data-approve-blocked', 'true')
        await userEvent.click(screen.getByTestId('action-approve'))
        expect(mockWalletRequest).not.toHaveBeenCalled()

        await approveActionRequest()

        await waitFor(() => expect(mockWalletRequest).toHaveBeenCalledTimes(1))
        expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'eth_signTypedData_v4', params: [SIGNER, TYPED_DATA] })
      })
    })
  })
})
