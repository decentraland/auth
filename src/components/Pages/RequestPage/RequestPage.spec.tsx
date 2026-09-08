/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/naming-convention */
import { useLayoutEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
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
  SimulationResponseBody,
  SimulationUnavailableError,
  UnsupportedMethodError
} from '../../../shared/auth'
import { extractReferrerFromSearchParameters, getAuthRequestId, isBridgeOnlyEnabled } from '../../../shared/locations'
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
const mockSimulateTransaction = jest.fn()
const mockGetKnownDecentralandContract = jest.fn()
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
    }),
    getKnownDecentralandContract: (...args: any[]) => mockGetKnownDecentralandContract(...args),
    resolveKnownDecentralandContract: jest.fn()
  }
})

// --- Classification ---
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
jest.mock('../../../shared/errors', () => ({
  isErrorWithMessage: jest.fn().mockReturnValue(true),
  isRpcError: jest.fn().mockReturnValue(false),
  isUserRejectedTransaction: jest.fn().mockReturnValue(false),
  isChainMismatchRejection: (...args: any[]) => mockIsChainMismatchRejection(...args)
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
  SigningError: (props: any) => <div data-testid="signing-error">Signing Error: {props.error}</div>,
  WalletInteraction: (props: any) => (
    <div
      data-testid="wallet-interaction"
      data-sim={props.simulation?.status}
      data-requires-acknowledgment={String(props.requiresAcknowledgment)}
      data-gas-covered={String(props.gas?.covered)}
      data-gas-status={props.gas?.status ?? ''}
      data-function={props.functionName}
      data-contract={props.contractName}
      data-profiles={JSON.stringify(props.profiles ?? {})}
      data-verified={JSON.stringify(props.verifiedContracts ?? [])}
      data-review-restarted={String(props.reviewRestarted)}
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
  TransferConfirmView: (props: any) => (
    <div data-testid="transfer-confirm">
      <button data-testid="transfer-confirm-approve" onClick={props.onApprove}>
        confirm
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
    ) : null,
  SignatureRequestView: (props: any) => (
    <div
      data-testid="signature-request"
      data-method={props.method}
      data-sim={props.simulation?.status}
      data-requires-acknowledgment={String(props.requiresAcknowledgment)}
      data-function={props.functionName}
      data-contract={props.contractName}
      data-verifying-contract={props.verifyingContract}
    >
      <button data-testid="signature-approve" onClick={props.onApprove}>
        approve
      </button>
      <button data-testid="signature-deny" onClick={props.onDeny}>
        deny
      </button>
    </div>
  ),
  UnverifiedRequestView: (props: any) => (
    <div
      data-testid="unverified-request"
      data-kind={props.kind}
      data-method={props.method}
      data-target={props.targetAddress ?? ''}
      data-target-self={String(props.targetIsSelf ?? false)}
      data-chain={String(props.chainId ?? '')}
      data-gas={props.gas?.status ?? ''}
      data-payload={JSON.stringify(props.payload)}
      data-review-restarted={String(props.reviewRestarted)}
    >
      <button data-testid="unverified-approve" onClick={props.onApprove}>
        approve
      </button>
      <button data-testid="unverified-deny" onClick={props.onDeny}>
        deny
      </button>
    </div>
  )
}))

// --- Utils ---
const mockIsExactNftTransferSimulation = jest.fn()
const mockBuildSendTransactionSimulationPayload = jest.fn()
jest.mock('./utils', () => ({
  decodeManaTransferData: jest.fn().mockReturnValue(null),
  decodeNftTransferData: jest.fn().mockReturnValue(null),
  fetchNftMetadata: jest.fn(),
  fetchPlaceByCreatorAddress: jest.fn(),
  getConnectedProvider: jest.fn().mockResolvedValue({ isConnectedProvider: true }),
  getExplorerDeeplink: jest.fn().mockReturnValue('decentraland://open'),
  getSigninDeeplink: jest.fn().mockReturnValue('decentraland://open?signin=anIdentityId'),
  getMetaTransactionChainId: jest.fn().mockReturnValue(137),
  getNetworkProvider: jest.fn().mockResolvedValue({ isNetworkProvider: true }),
  isAddressWithoutCode: jest.fn(),
  isDecentralandCollection: jest.fn().mockResolvedValue(false),
  isExactNftTransferSimulation: (...args: any[]) => mockIsExactNftTransferSimulation(...args),
  buildSendTransactionSimulationPayload: (...args: any[]) => mockBuildSendTransactionSimulationPayload(...args)
}))

// Mock decentraland-transactions
jest.mock('decentraland-transactions', () => ({
  ContractName: { ERC721CollectionV2: 'ERC721CollectionV2', ERC20: 'ERC20', MANAToken: 'MANAToken' },
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
const SIGNER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const CONTRACT = '0xcontract'
const COLLECTION = '0xcollection'
const HELLO_HEX = '0x68656c6c6f'
// The deep-link handoff requires a valid UUID v4 route id (the client's correlation id).
const DEEP_LINK_REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000'
const DEEP_LINK_REQUEST_PATH = `/auth/requests/${DEEP_LINK_REQUEST_ID}?targetConfigId=default&flow=deeplink`

// --- Fixtures. Pure builders: every scenario assigns what it needs in its own beforeEach. ---
const erc721Transfer = (overrides: Partial<SimulationResponseBody['assetChanges'][number]> = {}) => ({
  type: 'transfer' as const,
  standard: 'erc721' as const,
  from: SIGNER,
  to: '0xrecipient',
  amount: null,
  rawAmount: null,
  tokenId: '1',
  contractAddress: COLLECTION,
  symbol: null,
  name: 'Wearable',
  decimals: null,
  logoUrl: null,
  dollarValue: null,
  ...overrides
})
const simulationOf = (overrides: Partial<SimulationResponseBody> = {}): SimulationResponseBody => ({
  status: 'success',
  assetChanges: [],
  approvalChanges: [],
  balanceChanges: [],
  events: [],
  ...overrides
})
// A simulation that matches the branded gift exactly: the connected account's token #1 leaves for the
// recipient on the called collection, and nothing else happens.
const exactGiftSimulation = simulationOf({ assetChanges: [erc721Transfer()] })
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
    mockIsChainMismatchRejection.mockReturnValue(false)
    mockIsExactNftTransferSimulation.mockReturnValue(true)
    mockGetBalance.mockResolvedValue(BigInt(1))
    mockGetChainId.mockResolvedValue(1)
    mockEstimateFeesPerGas.mockResolvedValue({ gasPrice: BigInt(1) })
    mockEstimateGas.mockResolvedValue(BigInt(21000))
    mockBuildSendTransactionSimulationPayload.mockReturnValue({ chainId: 137, from: SIGNER, to: CONTRACT, data: '0x', value: '0' })
    mockSimulateTransaction.mockResolvedValue(simulationOf())
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

      it('should show the unverified request view for an unknown transaction', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('unverified-request')).toHaveAttribute('data-kind', 'unknown_transaction')
      })

      it('should classify the request for the connected signer and chain', async () => {
        renderRequestPage()
        await screen.findByTestId('unverified-request')
        expect(mockClassifyRequest).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'eth_sendTransaction' }),
          expect.objectContaining({ signerAddress: SIGNER, connectedChainId: 1, metaTransactionChainId: 137 })
        )
      })

      it('should not run a simulation', async () => {
        renderRequestPage()
        await screen.findByTestId('unverified-request')
        expect(mockSimulateTransaction).not.toHaveBeenCalled()
      })

      it('should report the classification to analytics without the payload', async () => {
        renderRequestPage()
        await screen.findByTestId('unverified-request')
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

      it('should show the retryable error view instead of a review', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('recover-error')).toBeInTheDocument()
      })

      it('should leave the request unanswered so a retry can review it', async () => {
        renderRequestPage()
        await screen.findByTestId('recover-error')
        expect(mockSendFailedOutcome).not.toHaveBeenCalled()
        expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
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

      it('should show the error view instead of the unverified review', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('signing-error')).toBeInTheDocument()
        expect(screen.queryByTestId('unverified-request')).not.toBeInTheDocument()
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
      expect(await screen.findByTestId('unverified-request')).toBeInTheDocument()

      mockConnectionData = { ...mockConnectionData, account: '0xnewwallet' }
      rerenderRequestPage(rerender)

      expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
      expect(screen.queryByTestId('unverified-approve')).not.toBeInTheDocument()
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
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    it('should not report an outcome for it', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the different-account view instead of leaving an Allow button that does nothing', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      expect(await screen.findByTestId('different-account')).toBeInTheDocument()
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
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitForRecoverCalls(2)

      expect(mockWalletRequest).not.toHaveBeenCalled()
    })

    it('should recover the request again so it can be reviewed on the current network', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))

      await waitFor(() => expect(mockRecover).toHaveBeenCalledTimes(2))
    })

    it('should not report a successful outcome for the invalidated review', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitForRecoverCalls(2)

      expect(mockSendSuccessfulOutcome).not.toHaveBeenCalled()
    })

    it('should not report a failed outcome for the invalidated review', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitForRecoverCalls(2)

      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should tell the user on the fresh review that the network changed', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitForRecoverCalls(2)

      await waitFor(() => expect(screen.getByTestId('unverified-request')).toHaveAttribute('data-review-restarted', 'true'))
    })

    it('should report the restart and its reason to analytics', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
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
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitForRecoverCalls(2)

      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should not show the signing error view', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitForRecoverCalls(2)

      expect(screen.queryByTestId('signing-error')).not.toBeInTheDocument()
    })

    it('should report the restart with the wallet rejection as its reason', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
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
      await userEvent.click(await screen.findByTestId('unverified-approve'))
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
      await userEvent.click(await screen.findByTestId('unverified-deny'))
      await waitFor(() => expect(mockGetAddresses).toHaveBeenCalledTimes(2))
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the different-account view', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-deny'))
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

      it('should show the unverified view for a personal_sign with the bytes and the text', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('unverified-request')
        expect(view).toHaveAttribute('data-kind', 'personal_sign')
        expect(view).toHaveAttribute('data-payload', JSON.stringify({ kind: 'message', hex: HELLO_HEX, text: 'hello' }))
      })

      it('should hand the wallet the message bytes and the signer on approval', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        await waitFor(() => {
          expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: [HELLO_HEX, SIGNER] })
        })
      })

      it('should complete the interaction after a successful signature', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
      })

      it('should not run a simulation', async () => {
        renderRequestPage()
        await screen.findByTestId('unverified-request')
        expect(mockSimulateTransaction).not.toHaveBeenCalled()
      })
    })

    describe('and it is typed data that is not a MetaTransaction', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"Permit"}']))
      })

      it('should show the unverified view for unknown typed data with the raw JSON', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('unverified-request')
        expect(view).toHaveAttribute('data-kind', 'unknown_typed_data')
        expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual(
          expect.objectContaining({ kind: 'typed_data', raw: '{"primaryType":"Permit"}' })
        )
      })

      it('should hand the wallet the signer and the typed data on approval', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
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

      it('should show the unverified view naming the contract with only the original typed data', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('unverified-request')).toHaveAttribute('data-kind', 'unknown_meta_transaction')
        expect(screen.getByTestId('unverified-request')).toHaveAttribute('data-target', '0xunknown')
        expect(screen.getByTestId('unverified-request')).toHaveAttribute(
          'data-payload',
          JSON.stringify({ kind: 'typed_data', raw: '{"primaryType":"MetaTransaction"}' })
        )
      })

      it('should not simulate code Decentraland does not know', async () => {
        renderRequestPage()
        await screen.findByTestId('unverified-request')
        expect(mockSimulateTransaction).not.toHaveBeenCalled()
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
            reason: 'malformed'
          })
        })

        it('should pass only the original JSON to the view without endorsing the decoy', async () => {
          renderRequestPage()
          expect(await screen.findByTestId('unverified-request')).toHaveAttribute(
            'data-payload',
            JSON.stringify({ kind: 'typed_data', raw })
          )
        })

        it('should forward the original payload on approval', async () => {
          renderRequestPage()
          await userEvent.click(await screen.findByTestId('unverified-approve'))
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
        expect(await screen.findByTestId('unverified-request')).toHaveAttribute('data-payload', JSON.stringify({ kind: 'typed_data', raw }))
        expect(hash).not.toHaveBeenCalled()
      })

      it('should keep the request deniable without hashing on a rerender', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-deny'))
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
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      await waitFor(() => {
        expect(screen.getByTestId('wallet-interaction-complete')).toBeInTheDocument()
      })
      expect(mockSendFailedOutcome).not.toHaveBeenCalled()
    })

    it('should show the completion view instead of an error that would invite a second signature', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
      expect(await screen.findByTestId('wallet-interaction-complete')).toBeInTheDocument()
    })

    describe('and the failure is an expected already-fulfilled race', () => {
      beforeEach(() => {
        mockSendSuccessfulOutcome.mockRejectedValue(new RequestFulfilledError(REQUEST_ID))
      })

      it('should show the completion view without reporting a failed outcome', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
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

    it('should estimate the fee the user will pay', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('unverified-request')
      await waitFor(() => expect(view).toHaveAttribute('data-gas', 'ready'))
      expect(mockEstimateGas).toHaveBeenCalledWith({ account: SIGNER, to: CONTRACT, data: '0xabcd', value: BigInt(0) })
    })

    it('should send it as a plain transaction on the reviewed chain, never through the relay', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
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

      it('should tell the view the fee is unavailable rather than hide it', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('unverified-request')
        await waitFor(() => expect(view).toHaveAttribute('data-gas', 'unavailable'))
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
        await userEvent.click(await screen.findByTestId('unverified-approve'))
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
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        const dialog = await screen.findByTestId('confirm-request-dialog')
        expect(dialog).toHaveAttribute('data-kind', 'transaction')
        await waitFor(() => expect(dialog).toHaveAttribute('data-gas-status', 'ready'))
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })

      it('should send the transaction once the confirmation is given', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
        await screen.findByTestId('wallet-interaction-complete')
        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_sendTransaction',
          params: [{ to: CONTRACT, data: '0xabcd', value: '0x0', from: SIGNER, chainId: '0x1' }]
        })
      })

      it('should close the confirmation on cancel without sending', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        await userEvent.click(await screen.findByTestId('confirm-request-cancel'))
        expect(screen.queryByTestId('confirm-request-dialog')).not.toBeInTheDocument()
        expect(screen.getByTestId('unverified-request')).toBeInTheDocument()
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
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
        const dialog = await screen.findByTestId('confirm-request-dialog')
        expect(dialog).toHaveAttribute('data-kind', 'transaction')
        expect(dialog).toHaveAttribute('data-gas-covered', 'true')
        expect(sendMetaTransaction).not.toHaveBeenCalled()
      })

      it('should relay once the confirmation is given', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
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
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        const dialog = await screen.findByTestId('confirm-request-dialog')
        expect(dialog).toHaveAttribute('data-kind', 'signature')
        expect(dialog).toHaveAttribute('data-gas-covered', 'undefined')
        expect(mockWalletRequest).not.toHaveBeenCalled()
      })

      it('should sign once the confirmation is given', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('unverified-approve'))
        await userEvent.click(await screen.findByTestId('confirm-request-confirm'))
        await screen.findByTestId('wallet-interaction-complete')
        expect(mockWalletRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: [HELLO_HEX, SIGNER] })
      })
    })

    describe('and it is a Decentraland meta-transaction signature', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"MetaTransaction"}']))
        mockClassifyRequest.mockResolvedValue(dclMetaTransaction())
        mockSimulateTransaction.mockResolvedValue(
          simulationOf({ assetChanges: [erc721Transfer({ standard: 'erc20', contractAddress: '0xmana' })] })
        )
      })

      it('should ask for a confirmation before signing', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('signature-approve'))
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

    it('should show the unverified view as a native transfer with the recipient and the amount', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('unverified-request')
      expect(view).toHaveAttribute('data-kind', 'native_transfer')
      expect(view).toHaveAttribute('data-target', '0xrecipient')
      expect(JSON.parse(view.getAttribute('data-payload') ?? '{}')).toEqual({
        kind: 'transaction',
        to: '0xrecipient',
        data: '0x',
        value: '0xde0b6b3a7640000'
      })
    })

    it('should estimate the fee for the value being sent', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('unverified-request')
      await waitFor(() => expect(view).toHaveAttribute('data-gas', 'ready'))
      expect(mockEstimateGas).toHaveBeenCalledWith({ account: SIGNER, to: '0xrecipient', data: '0x', value: BigInt('0xde0b6b3a7640000') })
    })

    it('should send it as a plain transaction on the reviewed chain', async () => {
      renderRequestPage()
      await userEvent.click(await screen.findByTestId('unverified-approve'))
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

    it('should show the simulation review naming the decoded call and the contract', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      expect(view).toHaveAttribute('data-function', 'approve')
      expect(view).toHaveAttribute('data-contract', 'Decentraland MANA')
    })

    it('should preview the call with the classified transaction', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      expect(mockBuildSendTransactionSimulationPayload).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'dcl_transaction', relayed: true }),
        SIGNER
      )
      expect(mockSimulateTransaction).toHaveBeenCalledTimes(1)
    })

    it('should mark the interaction as gas-covered and not estimate a fee', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      expect(view).toHaveAttribute('data-gas-covered', 'true')
      expect(mockEstimateGas).not.toHaveBeenCalled()
    })

    it('should relay the reviewed calldata through the classified contract on approval', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
      await screen.findByTestId('wallet-interaction-complete')
      expect(sendMetaTransaction).toHaveBeenCalledWith(
        { isConnectedProvider: true },
        { isNetworkProvider: true },
        '0xabcd',
        { abi: [], address: CONTRACT, name: 'Decentraland MANA', version: '1', chainId: 137 },
        { serverURL: '10000/v1' }
      )
      expect(mockWalletRequest).not.toHaveBeenCalled()
      expect(mockSendSuccessfulOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, '0xrelayedhash')
    })

    describe('and the preview moves an asset of the called contract', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockResolvedValue(
          simulationOf({ assetChanges: [erc721Transfer({ contractAddress: CONTRACT, to: '0xother' })] })
        )
      })

      it('should treat the called contract as verified in the preview', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-verified', JSON.stringify([CONTRACT])))
      })
    })

    describe('and the preview shows what the user gets', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockResolvedValue(simulationOf({ assetChanges: [erc721Transfer({ from: '0xother', to: SIGNER })] }))
      })

      it('should not require an acknowledgment', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
      })
    })

    describe('and the preview shows no visible effects', () => {
      it('should require an acknowledgment instead of a single click', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and only third parties move assets', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockResolvedValue(simulationOf({ assetChanges: [erc721Transfer({ from: '0xthird', to: '0xother' })] }))
      })

      it('should require an acknowledgment because nothing shown involves the user', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the simulation is unavailable', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new SimulationUnavailableError('status 502', 502))
      })

      it('should still render the review (fail open) and require an acknowledgment because the relay executes the unpreviewable call', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the simulation names a counterparty with a Decentraland profile', () => {
      let counterparty: string

      beforeEach(() => {
        counterparty = '0x1111111111111111111111111111111111111234'
        mockSimulateTransaction.mockResolvedValue(
          simulationOf({ assetChanges: [erc721Transfer({ standard: 'erc20', to: counterparty, amount: '500' })] })
        )
      })

      afterEach(() => {
        jest.mocked(fetchProfile).mockReset()
      })

      describe('and the name is unclaimed', () => {
        beforeEach(() => {
          jest.mocked(fetchProfile).mockResolvedValue({ avatars: [{ name: 'Decentraland', hasClaimedName: false }] } as any)
        })

        it('should qualify the name with the address so a self-chosen name cannot pose as a trusted party', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-profiles', JSON.stringify({ [counterparty]: 'Decentraland#1234' })))
        })
      })

      describe('and the name is claimed', () => {
        beforeEach(() => {
          jest.mocked(fetchProfile).mockResolvedValue({ avatars: [{ name: 'Decentraland', hasClaimedName: true }] } as any)
        })

        it('should show the name on its own', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-profiles', JSON.stringify({ [counterparty]: 'Decentraland' })))
        })
      })
    })

    describe('and the simulation grants an approval', () => {
      let approval: SimulationResponseBody['approvalChanges'][number]

      beforeEach(() => {
        approval = {
          kind: 'approval',
          standard: 'erc20',
          owner: SIGNER,
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
      })

      describe('and it is a limited allowance to a spender that is not a recognized Decentraland contract', () => {
        beforeEach(() => {
          mockSimulateTransaction.mockResolvedValue(simulationOf({ approvalChanges: [approval] }))
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
          mockGetKnownDecentralandContract.mockImplementation((address: string) => (address === '0xspender' ? knownContract() : null))
          mockSimulateTransaction.mockResolvedValue(simulationOf({ approvalChanges: [approval] }))
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
          expect(mockGetKnownDecentralandContract).toHaveBeenCalledWith('0xspender', 137)
        })
      })

      describe('and it is a single token approved to a spender that is not a recognized Decentraland contract', () => {
        beforeEach(() => {
          mockSimulateTransaction.mockResolvedValue(
            simulationOf({ approvalChanges: [{ ...approval, standard: 'erc721', amount: null, rawAmount: null, tokenId: '7' }] })
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
          mockSimulateTransaction.mockResolvedValue(simulationOf({ approvalChanges: [{ ...approval, amount: '0', rawAmount: '1' }] }))
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
          mockSimulateTransaction.mockResolvedValue(
            simulationOf({
              approvalChanges: [
                {
                  ...approval,
                  standard: 'erc721',
                  spender: '0x0000000000000000000000000000000000000000',
                  amount: null,
                  rawAmount: null,
                  tokenId: '7'
                }
              ]
            })
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
          mockSimulateTransaction.mockResolvedValue(simulationOf({ approvalChanges: [{ ...approval, amount: '0', rawAmount: '0' }] }))
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
          mockSimulateTransaction.mockResolvedValue(
            simulationOf({
              approvalChanges: [{ ...approval, kind: 'approvalForAll', standard: 'erc721', amount: null, rawAmount: null, approved: false }]
            })
          )
        })

        it('should not require an acknowledgment', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
        })
      })

      describe('and it grants collection-wide access to an unrecognized operator', () => {
        beforeEach(() => {
          mockSimulateTransaction.mockResolvedValue(
            simulationOf({
              approvalChanges: [
                {
                  ...approval,
                  kind: 'approvalForAll',
                  standard: 'erc721',
                  spender: '0xattacker',
                  amount: null,
                  rawAmount: null,
                  approved: true
                }
              ]
            })
          )
        })

        it('should require an acknowledgment', async () => {
          renderRequestPage()
          const view = await screen.findByTestId('wallet-interaction')
          await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
          expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
        })
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

    it('should preview it and estimate the fee the user pays', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await waitFor(() => expect(view).toHaveAttribute('data-gas-status', 'ready'))
      expect(view).toHaveAttribute('data-gas-covered', 'false')
      expect(mockEstimateGas).toHaveBeenCalledWith({ account: SIGNER, to: CONTRACT, data: '0xabcd', value: BigInt(0) })
    })

    it('should send it as a plain transaction on the reviewed chain, never through the relay', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('wallet-interaction')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
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

    it('should show the donation transfer view and NOT run a simulation', async () => {
      renderRequestPage()
      expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
      expect(mockSimulateTransaction).not.toHaveBeenCalled()
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

    describe('and the recipient lookups fail', () => {
      beforeEach(() => {
        jest.mocked(fetchProfile).mockRejectedValue(new Error('catalyst down'))
      })

      afterEach(() => {
        jest.mocked(fetchProfile).mockReset()
      })

      it('should fall back to the simulation review instead of a bare confirmation', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()
        await waitFor(() => expect(mockSimulateTransaction).toHaveBeenCalled())
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
      mockSimulateTransaction.mockResolvedValue(exactGiftSimulation)
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

    it('should judge the fetched simulation against the decoded transfer for the connected signer', async () => {
      renderRequestPage()
      await screen.findByTestId('transfer-confirm')

      expect(mockIsExactNftTransferSimulation).toHaveBeenCalledWith(exactGiftSimulation, SIGNER, COLLECTION, {
        fromAddress: SIGNER,
        tokenId: '1',
        toAddress: '0xrecipient'
      })
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

    describe('and the simulation is still running', () => {
      let resolveSimulation: (result: unknown) => void

      beforeEach(() => {
        resolveSimulation = () => undefined
        mockSimulateTransaction.mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveSimulation = resolve
            })
        )
      })

      it('should show the generic review with the preview loading rather than the branded view or a bare spinner', async () => {
        renderRequestPage()
        const review = await screen.findByTestId('wallet-interaction')
        expect(review).toHaveAttribute('data-sim', 'loading')
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })

      it('should upgrade to the branded view only once the simulation matches the gift', async () => {
        renderRequestPage()
        await screen.findByTestId('wallet-interaction')
        resolveSimulation(exactGiftSimulation)
        expect(await screen.findByTestId('transfer-confirm')).toBeInTheDocument()
      })

      it('should keep a denial given before the simulation matches', async () => {
        renderRequestPage()
        await userEvent.click(await screen.findByTestId('wallet-interaction-deny'))
        await screen.findByTestId('denied-wallet-interaction')
        resolveSimulation(exactGiftSimulation)
        await waitFor(() => expect(mockIsExactNftTransferSimulation).not.toHaveBeenCalled())
        expect(screen.getByTestId('denied-wallet-interaction')).toBeInTheDocument()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })
    })

    describe('and the receiver callback produces additional asset effects', () => {
      beforeEach(() => {
        mockIsExactNftTransferSimulation.mockReturnValue(false)
      })

      it('should fall back to the generic simulation summary', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toHaveAttribute('data-sim', 'ready')
      })

      it('should not hide the additional effects behind the branded view', async () => {
        renderRequestPage()
        await screen.findByTestId('wallet-interaction')
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })
    })

    describe('and the transfer cannot be simulated', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new Error('simulation unavailable'))
      })

      it('should fall back to the generic review', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toHaveAttribute('data-sim', 'unavailable')
      })

      it('should require acknowledgment before the unpreviewed transfer can continue', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the token metadata cannot be fetched', () => {
      beforeEach(() => {
        jest.mocked(fetchNftMetadata).mockRejectedValueOnce(new Error('tokenURI reverted'))
      })

      it('should fall through to the generic review instead of the branded gift view', async () => {
        renderRequestPage()
        expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()
        expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
      })

      it('should still preview the transaction so approval is not a bare confirm', async () => {
        renderRequestPage()
        const review = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(review).toHaveAttribute('data-sim', 'ready'))
      })

      it('should reuse the simulation already shown instead of running it again', async () => {
        renderRequestPage()
        const review = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(review).toHaveAttribute('data-sim', 'ready'))
        expect(mockSimulateTransaction).toHaveBeenCalledTimes(1)
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
      expect(await screen.findByTestId('wallet-interaction')).toBeInTheDocument()
      expect(screen.queryByTestId('transfer-confirm')).not.toBeInTheDocument()
    })

    it('should not fetch token metadata from it', async () => {
      renderRequestPage()
      await screen.findByTestId('wallet-interaction')
      expect(fetchNftMetadata).not.toHaveBeenCalled()
    })
  })

  describe('when the request is a MetaTransaction signature for a Decentraland contract', () => {
    beforeEach(() => {
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockRecover.mockResolvedValue(recovered('eth_signTypedData_v4', [SIGNER, '{"primaryType":"MetaTransaction"}']))
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(dclMetaTransaction())
      // A preview with something to check: the user's own transfer.
      mockSimulateTransaction.mockResolvedValue(
        simulationOf({ assetChanges: [erc721Transfer({ standard: 'erc20', contractAddress: '0xmana', amount: '5' })] })
      )
      mockWalletRequest.mockResolvedValue('0xsignature')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      mockSendFailedOutcome.mockResolvedValue({})
    })

    it('should render the signature review naming the decoded call and the contract', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      expect(view).toHaveAttribute('data-function', 'transfer')
      expect(view).toHaveAttribute('data-contract', 'Decentraland MANA')
      expect(view).toHaveAttribute('data-verifying-contract', CONTRACT)
    })

    it('should preview the contract calling itself with the connected signer appended', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      expect(mockSimulateTransaction).toHaveBeenCalledWith({
        chainId: 137,
        from: CONTRACT,
        to: CONTRACT,
        data: `0xdeadbeef${SIGNER.slice(2)}`,
        value: '0'
      })
    })

    it('should not require acknowledgment for a preview that shows the transfer and no dangerous changes', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      expect(view).toHaveAttribute('data-requires-acknowledgment', 'false')
    })

    it('should hand the wallet the signer and the typed data on approval', async () => {
      renderRequestPage()
      const view = await screen.findByTestId('signature-request')
      await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
      await userEvent.click(screen.getByTestId('signature-approve'))
      await waitFor(() =>
        expect(mockWalletRequest).toHaveBeenCalledWith({
          method: 'eth_signTypedData_v4',
          params: [SIGNER, '{"primaryType":"MetaTransaction"}']
        })
      )
    })

    describe('and the preview shows no visible effects', () => {
      beforeEach(() => {
        // e.g. setMinters or transferCreatorship: succeeds, moves nothing, grants no allowance.
        mockSimulateTransaction.mockResolvedValue(simulationOf())
      })

      it('should require an acknowledgment because the call may change state the preview cannot show', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the inner call reverts', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockResolvedValue(simulationOf({ status: 'reverted', error: 'Trade not effective yet' }))
      })

      it('should require acknowledgment because the call can be relayed once it stops reverting', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the simulation is unavailable', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new SimulationUnavailableError('status 502', 502))
      })

      it('should degrade to the unavailable preview and require an acknowledgment because the signature is a bearer authorization', async () => {
        renderRequestPage()
        const view = await screen.findByTestId('signature-request')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'unavailable'))
        expect(view).toHaveAttribute('data-requires-acknowledgment', 'true')
      })
    })

    describe('and the server rejects the call itself', () => {
      beforeEach(() => {
        mockSimulateTransaction.mockRejectedValue(new SimulationUnavailableError('status 400', 400))
      })

      it('should show the signing error view instead of an unpreviewable signature', async () => {
        renderRequestPage()
        await waitFor(() => expect(screen.getByTestId('signing-error')).toBeInTheDocument())
      })

      it('should report an invalid-params outcome naming the unpreviewable call', async () => {
        renderRequestPage()
        await waitFor(() =>
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, {
            code: -32602,
            message: 'The "eth_signTypedData_v4" request parameters are malformed: the MetaTransaction call cannot be previewed'
          })
        )
      })
    })

    describe('and the user denies while the preview is still loading', () => {
      let rejectSimulation: (error: unknown) => void

      beforeEach(() => {
        mockSimulateTransaction.mockImplementation(
          () =>
            new Promise((_resolve, reject) => {
              rejectSimulation = reject
            })
        )
      })

      describe('and the server then rejects the call', () => {
        it('should keep the denied view and report only the user rejection', async () => {
          renderRequestPage()
          await userEvent.click(await screen.findByTestId('signature-deny'))
          await screen.findByTestId('denied-wallet-interaction')
          rejectSimulation(new SimulationUnavailableError('status 400', 400))
          await waitFor(() => expect(mockSendFailedOutcome).toHaveBeenCalledTimes(1))
          expect(screen.getByTestId('denied-wallet-interaction')).toBeInTheDocument()
          expect(mockSendFailedOutcome).toHaveBeenCalledWith(REQUEST_ID, SIGNER, { code: -32003, message: 'Transaction rejected' })
        })
      })
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
          <button data-testid="go-to-other" onClick={() => navigate(`/auth/requests/${otherRequestId}?targetConfigId=default`)}>
            other
          </button>
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
      mockSimulateTransaction.mockReset()
      mockEnsureProfile.mockResolvedValue({ avatars: [{ name: 'TestUser' }] })
      mockGetAddresses.mockResolvedValue([SIGNER])
      mockClassifyRequest.mockResolvedValue(dclTransaction())
      jest.mocked(sendMetaTransaction).mockResolvedValue('0xrelayedhash')
      mockSendSuccessfulOutcome.mockResolvedValue({})
      // The first request previews; the second never resolves, so any "ready" state seen after the
      // change can only be stale.
      mockSimulateTransaction.mockResolvedValueOnce(simulationOf()).mockImplementationOnce(() => new Promise(() => undefined))
    })

    afterEach(() => {
      mockRecover.mockReset()
      mockSimulateTransaction.mockReset()
    })

    describe('and the new request is recovered normally', () => {
      beforeEach(() => {
        mockRecover.mockResolvedValue(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
      })

      it('should recover the new request and preview it from scratch instead of reusing the old summary', async () => {
        renderMountedPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('go-to-other'))
        const fresh = await screen.findByTestId('wallet-interaction')
        expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true)
        expect(fresh).toHaveAttribute('data-sim', 'loading')
      })

      it('should recover the new request exactly once, after its own profile check', async () => {
        renderMountedPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('go-to-other'))
        // The profile check re-runs for the new id; a duplicate load would fire around its completion.
        await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalledTimes(2))
        await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(mockRecover.mock.calls.filter(call => call[0] === otherRequestId)).toHaveLength(1))
        expect(mockRecover.mock.calls.filter(call => call[0] === REQUEST_ID)).toHaveLength(1)
        expect(mockRecover).toHaveBeenCalledTimes(2)
      })

      it('should load the new request even though the previous one was completed', async () => {
        renderMountedPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('wallet-interaction-approve'))
        await screen.findByTestId('wallet-interaction-complete')
        await userEvent.click(screen.getByTestId('go-to-other'))
        await waitFor(() => expect(mockRecover.mock.calls.some(call => call[0] === otherRequestId)).toBe(true))
        expect(screen.queryByTestId('wallet-interaction-complete')).not.toBeInTheDocument()
      })
    })

    describe("and the new request's recovery is held", () => {
      beforeEach(() => {
        // The first recovery resolves; the second is held so the state between the change and the new
        // preview is observable.
        mockRecover
          .mockResolvedValueOnce(recovered('eth_sendTransaction', [{ to: CONTRACT, data: '0xabcd', value: '0x0' }]))
          .mockImplementation(() => new Promise(() => undefined))
      })

      it('should drop the previous preview and show the loading view before anything of the new request', async () => {
        renderMountedPage()
        const view = await screen.findByTestId('wallet-interaction')
        await waitFor(() => expect(view).toHaveAttribute('data-sim', 'ready'))
        await userEvent.click(screen.getByTestId('go-to-other'))
        expect(await screen.findByTestId('loading-request')).toBeInTheDocument()
        expect(screen.queryByTestId('wallet-interaction')).not.toBeInTheDocument()
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
          const commitsBefore = approvalUiAtCommit.length
          await userEvent.click(screen.getByTestId('go-to-other'))
          expect(approvalUiAtCommit.length).toBeGreaterThan(commitsBefore)
          expect(approvalUiAtCommit.slice(commitsBefore).some(present => present)).toBe(false)
        })
      })
    })
  })
})
