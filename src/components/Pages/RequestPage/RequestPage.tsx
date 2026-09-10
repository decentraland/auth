import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { sendMetaTransaction } from 'decentraland-transactions'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { useSkipSetup } from '../../../hooks/useSkipSetup'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { fetchProfile, fetchProfiles } from '../../../modules/profile'
import {
  ContractLookupUnavailableError,
  DecodedCall,
  DifferentSenderError,
  ExpiredRequestError,
  IdentityResponse,
  ImpersonatedSignInError,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
  OutcomeError,
  RecoverResponse,
  RequestFulfilledError,
  ReviewedSignerMismatchError,
  SimulationRequestBody,
  SimulationResponseBody,
  SimulationUnavailableError,
  UnsupportedContractError,
  UnsupportedMethodError,
  bindProviderToSigner,
  buildMetaTransactionSimulationPayload,
  createAuthServerHttpClient,
  getKnownDecentralandContract,
  getKnownToken,
  getPreviewFingerprint,
  hasNoVisibleEffects,
  isDangerousApproval,
  isRecognizedDecentralandContract,
  resolveKnownDecentralandContract,
  withoutAllowanceConsumption
} from '../../../shared/auth'
import { isRetiredSignInMethod } from '../../../shared/auth/signMethodGuard'
import { isSocialProviderType, useCurrentConnectionData } from '../../../shared/connection'
import { isSessionMismatch } from '../../../shared/connection/sessionMismatch'
import { isChainMismatchRejection, isErrorWithMessage, isRpcError, isUserRejectedTransaction } from '../../../shared/errors'
import {
  buildRequestPageUrl,
  extractReferrerFromSearchParameters,
  getAuthRequestId,
  isBridgeOnlyEnabled,
  isDeepLinkFlowEnabled,
  isValidUuidV4
} from '../../../shared/locations'
import { sendTipNotification } from '../../../shared/notifications'
import { getProfileDisplayName } from '../../../shared/profile'
import { listAddresses } from '../../../shared/text'
import { identifyUser, trackEvent } from '../../../shared/utils/analytics'
import { handleError } from '../../../shared/utils/errorHandler'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import {
  RequestClassification,
  classifyRequest,
  describeClassification,
  getPayloadFingerprint,
  isDecentralandClassification,
  isTransactionClassification
} from './classifyRequest'
import { GasEstimateState, MANATransferData, NFTTransferData, SimulationState, TransferType } from './types'
import {
  buildSendTransactionSimulationPayload,
  decodeManaTransferData,
  decodeNftTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  getConnectedProvider,
  getCounterpartyAddresses,
  getExplorerDeeplink,
  getMetaTransactionChainId,
  getNetworkProvider,
  getSigninDeeplink,
  isAddressWithoutCode,
  isDecentralandCollection,
  isExactNftTransferSimulation
} from './utils'
import {
  ClientLoginError,
  ConfirmRequestDialog,
  ContinueInApp,
  DeniedWalletInteraction,
  DifferentAccountError,
  LoadingRequest,
  LookupUnavailableError,
  OutdatedClientError,
  RecoverError,
  SignatureRequestView,
  SigningError,
  TimeoutError,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  UnverifiedRequestView,
  WalletInteraction,
  WalletInteractionComplete
} from './Views'
import type { SigningErrorKind } from './Views'
import { ConfirmRequestGas } from './Views/ConfirmRequestDialog'
import { UnverifiedRequestViewProps } from './Views/UnverifiedRequest'
import { useAcknowledgment } from './Views/useAcknowledgment'
import { forwardSignatureRequest, toWalletSignatureRequest } from './walletSignatureRequest'

enum View {
  TIMEOUT,
  DIFFERENT_ACCOUNT,
  // Loading
  LOADING_REQUEST,
  LOADING_ERROR,
  // Decentraland's RPC could not say whether the target is a Decentraland contract (retryable here)
  LOOKUP_UNAVAILABLE,
  // Deep Link Flow
  DEEP_LINK_CONTINUE_IN_APP,
  // Client-login pseudo request (identity post failed)
  CLIENT_LOGIN_ERROR,
  // Request used the retired dcl_personal_sign sign-in (client too old to migrate)
  OUTDATED_CLIENT,
  // Wallet Interaction
  WALLET_INTERACTION,
  WALLET_SIGNATURE_INTERACTION,
  WALLET_UNVERIFIED_INTERACTION,
  WALLET_NFT_INTERACTION,
  WALLET_MANA_INTERACTION,
  WALLET_INTERACTION_DENIED,
  WALLET_NFT_INTERACTION_DENIED,
  WALLET_MANA_INTERACTION_DENIED,
  WALLET_INTERACTION_ERROR,
  WALLET_INTERACTION_COMPLETE,
  WALLET_NFT_INTERACTION_COMPLETE,
  WALLET_MANA_INTERACTION_COMPLETE
}

// Terminal views that should not trigger a re-fetch of the request
// The address approvals and mints/burns use to mean "nobody"; never a counterparty to name.
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * How many counterparties a preview may have names looked up for. Names are progressive enhancement — a
 * row without one shows the shortened address, which is what every row shows until its name arrives — so
 * this is bounded rather than fanned out over whatever a preview reports (up to 1,024 movements and 1,024
 * permissions).
 *
 * The bound is on the answer, not the requests: `fetchProfiles` asks in bulk, a hundred addresses per
 * request, so the count stopped being the expensive part. What a bulk answer carries is whole profiles —
 * avatar, wearables, snapshot URLs — for names of which only two fields are read, so it is payload that
 * has to be kept proportionate to a screen someone is reading. 200 is far past any review a person works
 * through (the recorded previews have one to three counterparties) and costs two requests.
 */
const MAX_ENRICHED_COUNTERPARTIES = 200

const TERMINAL_VIEWS = new Set([
  View.DEEP_LINK_CONTINUE_IN_APP,
  View.CLIENT_LOGIN_ERROR,
  View.OUTDATED_CLIENT,
  View.WALLET_INTERACTION_COMPLETE,
  View.WALLET_NFT_INTERACTION_COMPLETE,
  View.WALLET_MANA_INTERACTION_COMPLETE,
  View.WALLET_INTERACTION_DENIED,
  View.WALLET_NFT_INTERACTION_DENIED,
  View.WALLET_MANA_INTERACTION_DENIED,
  View.WALLET_INTERACTION_ERROR,
  View.TIMEOUT,
  View.LOADING_ERROR,
  View.DIFFERENT_ACCOUNT
])

// The views on which a request is still being reviewed, and whose expiry timer therefore stays armed.
const INTERACTION_VIEWS = new Set([
  View.WALLET_INTERACTION,
  View.WALLET_SIGNATURE_INTERACTION,
  View.WALLET_UNVERIFIED_INTERACTION,
  View.WALLET_NFT_INTERACTION,
  View.WALLET_MANA_INTERACTION
])

// Reported to the client when a request is rejected at recover time, before it reaches the wallet.
const RPC_METHOD_NOT_SUPPORTED = -32601
const RPC_INVALID_PARAMS = -32602

// Why a transaction review was discarded and started over (see restartReview).
type ReviewRestartReason = 'network_changed' | 'network_unreadable' | 'network_unrecorded' | 'wallet_rejected_chain' | 'lookup_unavailable'

type DecentralandTransaction = Extract<RequestClassification, { kind: 'dcl_transaction' }>

/**
 * The props of the unverified view that follow from the classification alone: what kind of request
 * it is, what it targets, and exactly what the wallet will be handed. Null for the previewed kinds.
 */
function getUnverifiedRequestProps(
  classification: RequestClassification
): Pick<UnverifiedRequestViewProps, 'kind' | 'targetAddress' | 'targetIsSelf' | 'chainId' | 'nativeValue' | 'payload'> | null {
  switch (classification.kind) {
    case 'unknown_transaction':
      return {
        kind: classification.kind,
        targetAddress: classification.to,
        chainId: classification.chainId,
        nativeValue: classification.value,
        payload: { kind: 'transaction', to: classification.to, data: classification.data, value: classification.value }
      }
    case 'native_transfer':
      return {
        kind: classification.kind,
        targetAddress: classification.to,
        targetIsSelf: classification.toSelf,
        chainId: classification.chainId,
        nativeValue: classification.value,
        payload: { kind: 'transaction', to: classification.to, data: '0x', value: classification.value }
      }
    case 'unknown_meta_transaction':
      return {
        kind: classification.kind,
        targetAddress: classification.verifyingContract,
        chainId: classification.chainId,
        // Unverified schemas can carry unsigned decoy fields and take exponential work to hash.
        // Show only the original JSON; do not infer a call or compute a digest during rendering.
        payload: { kind: 'typed_data', raw: classification.raw }
      }
    case 'unknown_typed_data':
      return {
        kind: classification.kind,
        payload: { kind: 'typed_data', raw: classification.raw }
      }
    case 'personal_sign':
      return { kind: classification.kind, payload: { kind: 'message', hex: classification.hex, text: classification.text } }
    default:
      return null
  }
}

export const RequestPage = () => {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigateWithSearchParams()
  const { isLoading: isConnecting, account, provider, providerType, identity } = useCurrentConnectionData()
  const { initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const { trackClick } = useAnalytics()
  const { ensureProfile } = useEnsureProfile()
  const publicClientRef = useRef<ReturnType<typeof createPublicClient>>()
  const walletClientRef = useRef<ReturnType<typeof createWalletClient>>()
  const [view, setView] = useState(View.LOADING_REQUEST)
  const [isLoading, setIsLoading] = useState(false)
  // The wallet's chain and, when it could be read, the account's native balance. The balance is display
  // only: a failed read leaves it out rather than showing a zero the account does not have.
  const [walletInfo, setWalletInfo] = useState<{
    balance?: bigint
    chainId: number
  }>()
  // What the recovered request is (see classifyRequest). Null until classification resolves; nothing
  // is rendered for the request before then, so Allow cannot exist before its kind is known. The ref
  // is what the approve path reads, so it dispatches on exactly what was reviewed.
  const [classification, setClassification] = useState<RequestClassification | null>(null)
  const classificationRef = useRef<RequestClassification | null>(null)
  // The wallet-side fee estimate of a transaction the user pays gas for. Null when no estimate applies.
  const [gasEstimate, setGasEstimate] = useState<GasEstimateState | null>(null)
  const [nftTransferData, setNftTransferData] = useState<NFTTransferData | null>(null)
  const [manaTransferData, setManaTransferData] = useState<MANATransferData | null>(null)
  // The confirmation dialog web2 users get on every Allow (see handleApproveWalletInteraction).
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [simulationState, setSimulationState] = useState<SimulationState>({ status: 'idle' })
  // Whether every contract the reviewed call reaches is Decentraland's (see verifyCounterparties). Decided
  // alongside the simulation, and Allow stays blocked until it is; a call that reaches anything else is
  // refused, so Allow never enables on a preview the page would not stand behind.
  const [areCounterpartiesVerified, setAreCounterpartiesVerified] = useState(false)
  // Resolved counterparty display names (lowercased address → name), filled in progressively.
  const [simulationProfiles, setSimulationProfiles] = useState<Record<string, string>>({})
  // Chain the pending transaction/meta-tx was simulated on, for block-explorer links.
  const [simulationChainId, setSimulationChainId] = useState<number>()
  // Lowercased addresses in the simulation that are recognized Decentraland contracts.
  const [simulationVerified, setSimulationVerified] = useState<string[]>([])
  // Lowercased addresses of collections a Decentraland factory deployed, among the called contract and
  // the call's counterparties (see verifyCounterparties): Decentraland code carrying content anyone can
  // create, so the summary names them as collections instead of vouching for them by name.
  const [simulationCollections, setSimulationCollections] = useState<string[]>([])
  // The account this review was produced for: the one the wallet reported when the request was loaded,
  // which is the `from` every preview was simulated as. The summary and the no-visible-effects gate read
  // the preview against this and never against `account`, which is a separate source (the connection
  // state) that can lag a wallet-side account switch. Read against another address, every movement would
  // fall outside the summary's "you send"/"you receive" filters and a transaction that moves assets would
  // render as "no changes" behind a single checkbox.
  const [reviewedSignerAddress, setReviewedSignerAddress] = useState<string>()
  const requestRef = useRef<RecoverResponse>()
  const viewRef = useRef(view)
  viewRef.current = view
  // The current value of `isReviewActionable`, for the approval handler to read at the moment it acts. It
  // is assigned during render, like `viewRef`, because the handler is created before the value is derived.
  const isReviewActionableRef = useRef(false)
  const hasCompletedRef = useRef(false)
  // The request id and account whose state this mounted page currently holds (see the load effect).
  // The refs are read by the effect; the state drives rendering, so a route or account change is
  // caught on its own render.
  const loadedRequestIdRef = useRef<string>()
  const [loadedRequestId, setLoadedRequestId] = useState<string>()
  const loadedAccountRef = useRef<string>()
  const [loadedAccount, setLoadedAccount] = useState<string>()
  // Incremented when an approval discovers that its transaction review is no longer bound to a
  // verifiable live chain. This deliberately re-runs the load effect for the same route/account.
  const [reviewAttempt, setReviewAttempt] = useState(0)
  // The reason a restart is pending, consumed by the load effect's reset so the re-reviewed page can
  // say why it reloaded. A genuinely new request or account starts with no reason.
  const pendingReviewRestartRef = useRef<ReviewRestartReason>()
  const [reviewRestartReason, setReviewRestartReason] = useState<ReviewRestartReason | null>(null)
  // The route id the recovered request in requestRef belongs to.
  const recoveredRequestIdRef = useRef<string>()
  // The lowercased account that recovered, and is reviewing, the request in requestRef. Only that
  // account may execute it: an external wallet can switch accounts while the page is open, and the
  // wallet would then run the reviewed request from an account that never saw it.
  const recoveredSignerRef = useRef<string>()
  // The connected chain on which an eth_sendTransaction request was reviewed. A wallet can change
  // networks while this page remains mounted without changing its account, so the plain-send
  // approve path must compare the live chain with this value before sending. Relayed
  // meta-transactions are excluded from that check: their execution chain is fixed by
  // getMetaTransactionChainId rather than by the wallet's active chain.
  const reviewedWalletChainIdRef = useRef<number>()
  // Guards against re-entrant approvals (e.g. a fast double-click on the confirm dialog),
  // which would otherwise fire two transactions before `isLoading` re-renders the buttons.
  // Whether Allow or Deny is answering the request right now. Both handlers check and set it synchronously
  // before their first await, so opposing clicks in the same tick, or a second click before React disables
  // the buttons, cannot start a second operation: one request gets one answer.
  const isSettlingRef = useRef(false)
  // Which review the page is on: bumped by the load effect whenever the request id or the account changes.
  // Allow and Deny capture it when they start and, after every await, touch no view, loading or settle
  // state unless it is still current: a late wallet or server result belongs to the review that started
  // it, not to the one on screen (see onDenyWalletInteraction, onApproveWalletInteraction).
  const reviewGenerationRef = useRef(0)
  /**
   * Which load produced the review on screen. Advanced by every load, including one that runs again for
   * the same request and the same account — where `reviewGenerationRef` deliberately does not move,
   * because that tracks the settlement scope (whose outcome an in-flight action may still deliver) rather
   * than which review is being looked at.
   *
   * An approval captures this when it is clicked and must still hold it when it dispatches. Without that,
   * a click given to one review can dispatch the next: the action's generation is unchanged, so it looks
   * current, and by the time its first await resolves the replacement review may have settled and made
   * the shared gates true again — for a screen the user never saw.
   */
  const reviewRunRef = useRef(0)
  // Shares the in-flight identity POST across effect re-runs so the client-login flow
  // creates the identity exactly once; cleared on failure so a retry can re-post.
  const clientLoginPromiseRef = useRef<Promise<IdentityResponse> | null>(null)
  // Tracks the deep-link-opened analytics event so it fires once even though the
  // client-login ContinueInApp view stays mounted across manual re-launches.
  const hasTrackedDeepLinkRef = useRef(false)
  // Ref to read the latest identity inside the effect without adding it as a dependency.
  // Only used in the profile-check effect (profile redeployment). Callbacks like
  // onApproveSignInVerification close over `identity` directly so they stay consistent
  // with the account that initiated the action.
  const identityRef = useRef(identity)
  identityRef.current = identity
  // Which (request id, account) the profile check has cleared. Scoped rather than a boolean on purpose:
  // on the commit where the route id or the account changes, the load effect runs in the same pass as
  // the profile effect, before the profile reset has rendered. A boolean would still read `true` from
  // the previous request there and start loading the new one at once, to be cancelled and loaded
  // again when the check completes. A mismatch on the pair waits for the new check instead.
  const [profileReadyFor, setProfileReadyFor] = useState<{ requestId: string; account: string } | null>(null)
  const [error, setError] = useState<string>()
  // Why the signing error view is shown, for its translated explanation (see SigningErrorKind).
  const [errorKind, setErrorKind] = useState<SigningErrorKind | null>(null)
  const [identityId, setIdentityId] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const requestId = params.requestId ?? ''
  // Whether the profile check has cleared this very (request id, account); see profileReadyFor.
  const isProfileReady = profileReadyFor !== null && profileReadyFor.requestId === requestId && profileReadyFor.account === account
  const [targetConfig, targetConfigId] = useTargetConfig()
  const skipSetup = useSkipSetup()
  // Social / web2 wallets (Magic and Thirdweb) sign without their own confirmation UI. Every review
  // screen is the same for them and for external wallets; the one place the distinction survives is
  // Allow itself, where web2 users get a confirmation dialog before the request executes because
  // nothing else will ask them again.
  const isUserUsingWeb2Wallet = isSocialProviderType(providerType)
  const authServerClient = useRef(createAuthServerHttpClient())
  // The deep-link flow (opted in via `?flow=deeplink`, compared case-insensitively) has no
  // backing auth-server request: skip the whole recover/verify flow and hand the signed identity
  // to the client via the `open?signin=<identityId>` deep link, the same way the standalone mobile
  // flow does. Its request id is a client-generated UUID v4 used to correlate the login with the
  // instance that requested it — forwarded to the client as the deep link's `authRequestId`.
  const isDeepLinkFlow = isDeepLinkFlowEnabled(searchParams)
  // A deep-link handoff requires a valid UUID v4 id. A malformed id is a client bug, so reject it
  // with the error view instead of posting an identity for it.
  const isInvalidDeepLinkId = isDeepLinkFlow && !isValidUuidV4(requestId)
  // The bridgeOnly flag rides inside redirectTo so it survives logins/callbacks and can be
  // appended to the client deep link once the flow completes.
  const isBridgeOnly = isBridgeOnlyEnabled(searchParams)
  // Like bridgeOnly: rides inside redirectTo across logins/callbacks and is forwarded
  // verbatim onto the client deep link.
  const authRequestId = getAuthRequestId(searchParams)
  // Goes to the login page where the user will have to connect a wallet.
  // Preserve loginMethod from current URL if present for auto-login functionality
  const loginMethodParam = searchParams.get('loginMethod')

  const toLoginPage = useCallback(() => {
    // Preserve the referrer across the login round-trip so a new wallet user that
    // isn't connected yet still carries attribution back to this page after login.
    // It travels twice on purpose: embedded in redirectTo (so it survives the trip
    // back here) AND as a top-level /login param (LoginPage reads its own URL to
    // hand the referrer to the profile setup flow, where the referral is registered).
    const referrer = extractReferrerFromSearchParameters(searchParams)
    const redirectToUrl = buildRequestPageUrl(requestId, targetConfigId, { isDeepLinkFlow, isBridgeOnly, authRequestId, referrer })
    const loginMethodQuery = loginMethodParam ? `&loginMethod=${encodeURIComponent(loginMethodParam)}` : ''
    const referrerQuery = referrer ? `&referrer=${encodeURIComponent(referrer)}` : ''
    const finalUrl = `/login?redirectTo=${encodeURIComponent(redirectToUrl)}${loginMethodQuery}${referrerQuery}`
    navigate(finalUrl)
  }, [requestId, targetConfigId, isDeepLinkFlow, isBridgeOnly, authRequestId, loginMethodParam, navigate, searchParams])

  // Effect 1: Ensure profile consistency before allowing request loading.
  // Navigates to setup if the profile is incomplete or missing.
  // Records the (request id, account) the profile is confirmed complete for (or skipped).
  useEffect(() => {
    // A deep-link handoff with a malformed id short-circuits to the error view (see the load
    // effect below); skip the profile work so it can't navigate to setup for a request we reject.
    if (isInvalidDeepLinkId) return
    if (isConnecting || !account || !provider || !providerType) return
    if (!initializedFlags) return

    // Clear whatever was cleared before, so loadRequest never fires on stale profile state.
    setProfileReadyFor(null)

    if (skipSetup) {
      setProfileReadyFor({ requestId, account })
      return
    }

    let cancelled = false

    const checkProfile = async () => {
      const redirectTo = buildRequestPageUrl(requestId, targetConfigId, { isDeepLinkFlow, isBridgeOnly, authRequestId })
      const referrer = extractReferrerFromSearchParameters(searchParams)
      try {
        const profile = await ensureProfile(account, identityRef.current, { redirectTo, referrer })

        if (!cancelled && profile) {
          setProfileReadyFor({ requestId, account })
        }
      } catch (e) {
        // ensureProfile throws when the catalysts couldn't be reached (profile state unknown).
        // Don't proceed to load/sign the request on an indeterminate profile — show the
        // recoverable error view instead of silently hanging on the loading spinner.
        if (cancelled) return
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.LOADING_ERROR)
      }
    }

    checkProfile()

    return () => {
      cancelled = true
    }
  }, [
    ensureProfile,
    account,
    provider,
    providerType,
    isConnecting,
    initializedFlags,
    requestId,
    targetConfigId,
    isDeepLinkFlow,
    isInvalidDeepLinkId,
    isBridgeOnly,
    authRequestId,
    searchParams,
    skipSetup
  ])

  // Effect 2: Load the request once the user is connected and the profile is ready.
  useEffect(() => {
    // A different request id, or a different account, on a still-mounted page starts over, before
    // any other branch runs. Everything derived from the previous request — its classification,
    // preview, verified contracts and completion — must go; otherwise a click on Allow could execute
    // the new request under the previous request's summary and acknowledgment. `loadedRequestId`
    // and `loadedAccount` are what the render reads: until both match, the page shows the loading
    // view and nothing of the previous review. The account is part of the key because an external
    // wallet can switch accounts while the page is open: the request was reviewed by the previous
    // account, and the wallet would now execute it from the new one, so nothing of that review may
    // stay actionable until the new account has recovered the request itself (and the sender check
    // has had its say). The reset is keyed to these two so re-runs of this effect for other
    // dependencies leave in-flight state untouched. Approval can also explicitly invalidate the
    // current review by clearing the request ref and incrementing reviewAttempt below.
    const isNewRequest = loadedRequestIdRef.current !== requestId || loadedAccountRef.current !== account
    if (isNewRequest) {
      loadedRequestIdRef.current = requestId
      loadedAccountRef.current = account
      recoveredRequestIdRef.current = undefined
      recoveredSignerRef.current = undefined
      reviewedWalletChainIdRef.current = undefined
      // A restart carries its reason into the fresh review; anything else starts clean.
      setReviewRestartReason(pendingReviewRestartRef.current ?? null)
      pendingReviewRestartRef.current = undefined
      hasCompletedRef.current = false
      // A new review is a new settlement scope: an action still pending for the previous one may finish
      // its own outcome delivery but no longer speaks for this page (see reviewGenerationRef).
      isSettlingRef.current = false
      reviewGenerationRef.current += 1
      requestRef.current = undefined
      classificationRef.current = null
      // Deep-link handoff state is per request as well: a new id is a new identity handoff.
      clientLoginPromiseRef.current = null
      hasTrackedDeepLinkRef.current = false
      setIdentityId(undefined)
      setLoadedRequestId(requestId)
      setLoadedAccount(account)
      setView(View.LOADING_REQUEST)
      setIsLoading(false)
      setError(undefined)
      setErrorKind(null)
      setWalletInfo(undefined)
      setClassification(null)
      setAreCounterpartiesVerified(false)
      setGasEstimate(null)
      setNftTransferData(null)
      setManaTransferData(null)
      setIsTransactionModalOpen(false)
      setSimulationState({ status: 'idle' })
      setSimulationProfiles({})
      setSimulationChainId(undefined)
      setSimulationVerified([])
      setSimulationCollections([])
      setReviewedSignerAddress(undefined)
    }

    // A deep-link handoff requires a valid UUID v4 id (the client's correlation id). Reject a
    // malformed id up front with the error view instead of running the login handoff for it.
    // Surface the reason (rendered as the error detail) so the copy matches the cause — a retry
    // won't fix a bad id, but the message tells the user the link itself is the problem.
    if (isInvalidDeepLinkId) {
      trackEvent(TrackingEvents.DEEP_LINK_AUTH_FAILED, { authRequestId: requestId, reason: 'invalid_request_id' })
      setError('The sign-in link is invalid.')
      setView(View.CLIENT_LOGIN_ERROR)
      return
    }
    if (isConnecting) return

    if (!account || !provider || !providerType) {
      toLoginPage()
      return
    }

    // When coming from Explorer (skipSetup + loginMethod), always route through
    // AutoLoginRedirect even if a wallet is already connected. This ensures new
    // users without a profile get the clean AutoLoginRedirect spinner instead of
    // RequestPage's verification UI (which shows a broken wearable preview for
    // users without a profile). This also fires for returning users with a cached
    // wallet — they take an extra round-trip through AutoLoginRedirect, but this
    // is intentional to keep the routing logic simple and avoid race conditions
    // with feature flag loading timing.
    if (skipSetup && loginMethodParam) {
      toLoginPage()
      return
    }

    // If the active session doesn't match the requested loginMethod,
    // navigate to login immediately. AutoLoginRedirect will call connectToProvider()
    // which overrides the stale session internally.
    if (isSessionMismatch(providerType, loginMethodParam)) {
      toLoginPage()
      return
    }

    if (!initializedFlags || !isProfileReady) return

    // Same request, already in a terminal view (completed, denied, error...): dependency changes
    // must not re-fetch an already-consumed request. A new request is never gated by the previous
    // request's terminal view.
    if (!isNewRequest && (TERMINAL_VIEWS.has(viewRef.current) || hasCompletedRef.current)) {
      return
    }

    let cancelled = false
    // A resume point of the load is stale when the effect was cancelled (another request or account took
    // over) or the request has been settled in the meantime: answered, or expired. Either way none of the
    // state it would set belongs on screen any more.
    const isStale = () => cancelled || hasCompletedRef.current

    // Client-login flow: no request to recover. Post the identity generated during login
    // to the auth server and let the client retrieve it through the `open?signin=<id>`
    // deep link, which ContinueInApp opens automatically once its countdown ends.
    const completeClientLoginFlow = async () => {
      identifyUser(account)

      const currentIdentity = identityRef.current
      if (!currentIdentity) {
        // The login page always generates an identity on connect, so this only happens
        // when the cached identity is missing or expired — log in again to get one.
        toLoginPage()
        return
      }

      try {
        // Reuse an in-flight POST if the effect re-runs mid-request so the identity is
        // created exactly once instead of leaving an orphaned identity on the server.
        // Forward the route UUID as the correlation id so the success event (fired inside
        // postIdentity) can be tied to the instance that requested the login.
        if (!clientLoginPromiseRef.current) {
          clientLoginPromiseRef.current = authServerClient.current.postIdentity(currentIdentity, { authRequestId: requestId })
        }
        const identityResponse = await clientLoginPromiseRef.current
        if (cancelled) return
        setIdentityId(identityResponse.identityId)
        setView(View.DEEP_LINK_CONTINUE_IN_APP)
      } catch (e) {
        // Clear the shared promise so Try Again (a page reload) can post again.
        clientLoginPromiseRef.current = null
        if (cancelled) return
        trackEvent(TrackingEvents.DEEP_LINK_AUTH_FAILED, { authRequestId: requestId, reason: 'post_identity_failed' })
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.CLIENT_LOGIN_ERROR)
      }
    }

    const loadRequest = async () => {
      const timeTheSiteStartedLoading = Date.now()
      const publicClient = createPublicClient({ transport: custom(provider) })
      publicClientRef.current = publicClient
      walletClientRef.current = createWalletClient({ chain: mainnet, transport: custom(provider) })
      // Held outside the try so the catch can name a sender when it reports a rejection.
      let connectedAddress: string | undefined

      // Nothing else answers a request rejected before the wallet, so without this the client blocks
      // until it expires. Best-effort: the error view is the user-facing answer.
      const reportRejectedRequest = async (code: number, message: string) => {
        if (!connectedAddress) return

        try {
          await authServerClient.current.sendFailedOutcome(requestId, connectedAddress, { code, message })
        } catch (error) {
          console.error('Failed to send rejected request outcome:', error)
        }
      }

      // Ends the review by refusing the request: the requester is answered with invalid params and the
      // user sees why, in the words of `kind`; a retry recovers the same request and is refused again.
      // Nothing to refuse once the user has already answered (e.g. denied while a check was running).
      const refuseRequest = async (rejection: Error, kind: SigningErrorKind) => {
        if (hasCompletedRef.current) return
        hasCompletedRef.current = true
        setError(rejection.message)
        setErrorKind(kind)
        setView(View.WALLET_INTERACTION_ERROR)
        await reportRejectedRequest(RPC_INVALID_PARAMS, rejection.message)
      }

      try {
        const [signerAddress] = await walletClientRef.current.getAddresses()
        connectedAddress = signerAddress
        identifyUser(signerAddress)
        // Recover the request from the auth server. Only the non-deep-link flow reaches here — the
        // deep-link handoff has no backing request and never recovers.
        const request = await authServerClient.current.recover(requestId, signerAddress)

        if (isStale()) return

        requestRef.current = request
        recoveredRequestIdRef.current = requestId
        recoveredSignerRef.current = signerAddress.toLowerCase()
        // The rendered counterpart of the ref above: set before any preview is requested, so a preview
        // that resolves is always read against the account it was simulated for.
        setReviewedSignerAddress(signerAddress.toLowerCase())

        // Initialize the timeout to display the timeout view when the request expires.
        // Guard against an unparseable expiration: `new Date(...).getTime()` would be NaN,
        // which setTimeout coerces to 0 and fires the timeout view immediately.
        // A negative delay (a request that is already past its expiration) is intentional:
        // setTimeout coerces it to 0 so the timeout view shows right away.
        const expirationDelay = new Date(request.expiration).getTime() - Date.now()
        if (!Number.isNaN(expirationDelay)) {
          timeoutRef.current = setTimeout(() => {
            getAnalytics()?.track(TrackingEvents.REQUEST_EXPIRED, {
              browserTime: Date.now(),
              requestTime: new Date(request.expiration).getTime(),
              timeTheSiteStartedLoading
            })
            // Expiry is terminal: it settles the request like an answer does, so nothing that resolves
            // later (the classification, a branded lookup, the simulation) can put an actionable review
            // back on screen, and neither Allow nor Deny can act on the expired request.
            hasCompletedRef.current = true
            setView(View.TIMEOUT)
          }, expirationDelay)
        }

        // Resolves Decentraland profile names for the transaction's counterparties as a
        // progressive enhancement — the summary renders immediately with addresses and names
        // fill in when (and if) they resolve. Never blocks or fails the summary.
        // Names follow the rule the rest of the UI uses (getProfileDisplayName): only a claimed
        // name stands on its own; an unclaimed one is free text anyone can set, so it is qualified
        // with the address, or a wallet named "Decentraland" would read as the counterparty
        // "Decentraland" in "You send".
        const resolveSimulationProfiles = async (result: SimulationResponseBody) => {
          const user = signerAddress.toLowerCase()
          // Only the addresses the summary puts on screen. It shows one counterparty per movement the
          // signer is party to — the other side of it — and one spender per permission; a mint or a burn
          // names no counterparty, and a movement between third parties is not rendered at all. Asking for
          // a name that nothing displays is a request made for nobody.
          const addresses = new Set<string>()
          const consider = (address: string | null) => {
            if (!address || addresses.size >= MAX_ENRICHED_COUNTERPARTIES) return
            const normalized = address.toLowerCase()
            if (normalized === user || normalized === ZERO_ADDRESS) return
            addresses.add(normalized)
          }
          for (const change of result.assetChanges) {
            if (change.type !== 'transfer') continue
            if (change.from?.toLowerCase() === user) consider(change.to)
            else if (change.to?.toLowerCase() === user) consider(change.from)
          }
          for (const approval of result.approvalChanges) {
            consider(approval.spender)
          }

          if (addresses.size === 0) return
          // Asked in bulk, so the whole set costs a request or two rather than one per address (see
          // fetchProfiles). The rows the cap leaves out keep the shortened address, which is what every row
          // shows until a name arrives, and the cap takes the rows nearest the top first.
          const profiles = await fetchProfiles([...addresses])
          const resolved: Record<string, string> = {}
          for (const address of addresses) {
            const name = getProfileDisplayName(profiles.get(address), address)
            if (name) resolved[address] = name
          }

          if (isStale()) return
          if (Object.keys(resolved).length > 0) {
            setSimulationProfiles(resolved)
          }
        }

        // Collects the addresses in the simulation that are recognized Decentraland contracts, so the
        // summary can show a "verified" badge next to them and the approval gate can tell a routine
        // permission to a Decentraland contract from one handed to anyone else. Recognition is per
        // chain: the addresses are judged against the registry deployments on the chain the
        // simulation ran on, never against the registry as a whole. The contract being called is
        // included too: a wearable collection is vouched for by the collection factories, not the registry.
        // Decentraland's own contracts only (the registry, plus the LAND and Estate registries it does not
        // carry). A factory collection is Decentraland code but carries content anyone can create, so the
        // summary names it as a collection (see verifyCounterparties) rather than badging it as Decentraland's.
        const collectVerifiedContracts = (result: SimulationResponseBody, chainId: number): string[] => {
          const verified = new Set<string>()
          const consider = (address: string | null) => {
            if (!address) return
            const normalized = address.toLowerCase()
            if (isRecognizedDecentralandContract(normalized, chainId)) verified.add(normalized)
          }
          for (const change of result.assetChanges) {
            consider(change.from)
            consider(change.to)
            consider(change.contractAddress)
          }
          for (const approval of result.approvalChanges) {
            consider(approval.spender)
            consider(approval.contractAddress)
          }
          return [...verified]
        }

        // Best-effort simulation of a Decentraland contract call. Fires without blocking the view
        // render and never throws to the caller — failures surface as "details unavailable".
        //
        // A 400 the server accounts for as `invalid_request` refuses the request: treating invalid calldata
        // as an outage would let the requester pick the RPC method that degrades. One it attributes to the
        // simulation provider (`upstream_rejected`) is the provider's problem, not the request's, and
        // degrades like an outage (5xx, timeouts) to the acknowledgment. A 400 with no account (a server
        // from before the codes) degrades a transaction, so a client deployed ahead of the server never
        // refuses a legitimate transaction for a provider-side 400, and refuses a signature, which leaves
        // Auth as a bearer authorization and was refused on any 400 before. Tighten the transaction rule to
        // the explicit code once the server is everywhere.
        const fetchSimulation = async (body: SimulationRequestBody, call: DecodedCall) => {
          try {
            // The server reports every approval it logged; which of them are grants is decided here, where
            // the function the signer called and the contract it called are known (see
            // withoutAllowanceConsumption).
            const result = withoutAllowanceConsumption(await authServerClient.current.simulateTransaction(body), {
              functionName: call.functionName,
              calledContract: body.to,
              signerAddress
            })
            if (isStale()) return
            // No Decentraland contract is an ERC-1155, so a preview that moves one has reached code that is
            // not Decentraland's, whatever the counterparty check concluded: refused, never summarized.
            if (result.assetChanges.some(change => change.standard === 'erc1155')) {
              await refuseRequest(
                new UnsupportedContractError(request.method, 'the preview moves an ERC-1155 asset, which no Decentraland contract issues'),
                'unsupported_contract'
              )
              return
            }
            setSimulationState({ status: 'ready', result })
            setSimulationVerified(collectVerifiedContracts(result, body.chainId))
            void resolveSimulationProfiles(result)
            return result
          } catch (e) {
            if (isStale()) return
            const isTransaction = request.method === 'eth_sendTransaction'
            const isRefusedByServer =
              e instanceof SimulationUnavailableError &&
              e.status === 400 &&
              (isTransaction ? e.code === 'invalid_request' : e.code !== 'upstream_rejected')
            if (isRefusedByServer) {
              await refuseRequest(
                isTransaction
                  ? new MalformedTransactionRequestError(request.method, 'the transaction call cannot be previewed')
                  : new MalformedSignatureRequestError(request.method, 'the MetaTransaction call cannot be previewed'),
                isTransaction ? 'malformed_transaction' : 'malformed_signature'
              )
              return
            }
            // Every review that loses its preview falls back to an acknowledgment the user can tick, so why
            // it was lost matters. `quota_exceeded` means our own rate limit refused the call, and that
            // budget is shared by every caller: a flood aimed at making previews disappear reads exactly
            // like provider flakiness from here unless the two are recorded apart.
            const reason =
              e instanceof SimulationUnavailableError ? (e.code ?? (e.status !== undefined ? `status_${e.status}` : 'error')) : 'error'
            console.info(`Transaction simulation unavailable (${reason}):`, e instanceof Error ? e.message : String(e))
            trackEvent(TrackingEvents.REQUEST_PREVIEW_UNAVAILABLE, { requestId, reason, method: request.method })
            setSimulationState({ status: 'unavailable' })
          }
        }

        // The page previews Decentraland's contracts and nothing else. Every address the call reaches (see
        // getCounterpartyAddresses: the ones its function actually calls, a safe transfer's recipient, the
        // registry of an order or a trade, a nested call) must be a Decentraland contract on the execution
        // chain (the registry, the LAND and Estate registries, a factory-deployed collection), one of the
        // stablecoins the marketplaces settle in (see getKnownToken) or a plain account without code, and
        // nothing the call carries may have gone unread; anything else is code
        // the requester chose, running inside the transaction, which a simulation cannot be relied on to
        // show, and the request is refused (the marketplaces accept any ERC-721 in an order or a trade;
        // Auth does not). Cheapest answer first: the registry costs nothing, one code read settles a plain
        // wallet (the usual counterparty), and only an address with code on the relay chain asks the
        // factories. Judged by Decentraland's RPC; when it cannot answer, the address counts as such code,
        // so the page never vouches for a preview on a guess; and a check that fails for any other reason
        // refuses too, so Allow is never left blocked on a check that will not settle. Runs alongside the
        // simulation on every previewed review, the branded ones included, so the outcome never depends on
        // the view; Allow stays blocked until it has settled. Resolves to whether the review goes on. On the
        // way it records which of the contracts involved are factory collections, the called one included
        // (it is one when the registry does not list it), for the summary to label. False means "do not go
        // on", whether the request was refused or the review went stale meanwhile; every caller stops on it.
        const verifyCounterparties = async (call: DecodedCall, chainId: number, contractAddress: string): Promise<boolean> => {
          const refuse = async (reason: string) => {
            if (!isStale()) await refuseRequest(new UnsupportedContractError(request.method, reason), 'unsupported_contract')
            return false
          }
          try {
            const collections = new Set<string>()
            if (!getKnownDecentralandContract(contractAddress, chainId)) {
              collections.add(contractAddress.toLowerCase())
              // Known before any lookup, so the summary never shows the called collection as unverified.
              setSimulationCollections([...collections])
            }
            const { addresses, opaque } = getCounterpartyAddresses(call, signerAddress, chainId)
            if (opaque) return refuse('the call carries a nested call that could not be read')
            const collectionsLiveHere = chainId === Number(getMetaTransactionChainId())
            const isRecognizedOrPlain = async (address: string): Promise<boolean> => {
              try {
                if (isRecognizedDecentralandContract(address, chainId) || getKnownToken(address, chainId)) return true
                if (await isAddressWithoutCode(address, chainId)) return true
                if (!collectionsLiveHere || !(await isDecentralandCollection(address))) return false
                collections.add(address.toLowerCase())
                return true
              } catch {
                return false
              }
            }
            const verdicts = await Promise.all(addresses.map(isRecognizedOrPlain))
            if (isStale()) return false
            const unrecognized = addresses.filter((_, index) => !verdicts[index])
            if (unrecognized.length > 0) {
              return refuse(`the call reaches a contract that is not Decentraland's: ${listAddresses(unrecognized)}`)
            }
            setSimulationCollections([...collections])
            setAreCounterpartiesVerified(true)
            return true
          } catch (e) {
            console.error('The contracts the call reaches could not be checked', e)
            return refuse('the contracts the call reaches could not be checked')
          }
        }

        // The wallet-side fee estimate for a transaction the user pays gas for (a plain send on the
        // connected chain). Non-blocking; the views keep Allow disabled until it resolves, so the cost
        // is always seen before sending, and say so when it cannot be estimated.
        const estimateTransactionFee = async (transaction: { to: string; data: string; value: string }) => {
          setGasEstimate({ status: 'loading' })
          try {
            const [feeData, gasUnits] = await Promise.all([
              publicClient.estimateFeesPerGas(),
              publicClient.estimateGas({
                account: signerAddress,
                to: transaction.to as `0x${string}`,
                data: transaction.data as `0x${string}`,
                value: BigInt(transaction.value)
              })
            ])
            if (isStale()) return
            const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0)
            setGasEstimate({ status: 'ready', cost: gasPrice * gasUnits })
          } catch (e) {
            if (isStale()) return
            console.info('Could not estimate the transaction fee:', e instanceof Error ? e.message : String(e))
            setGasEstimate({ status: 'unavailable' })
          }
        }

        // The review of a call to a Decentraland contract: the branded tip and gift screens when the
        // call is one of those, the generic simulation review otherwise. The branded screens are a
        // convenience over the generic review, not a gate: when one of their lookups fails (token
        // metadata, recipient profile, place), the generic review with its simulation and gates stands.
        const reviewDecentralandTransaction = async (transaction: DecentralandTransaction) => {
          setSimulationChainId(transaction.chainId)

          if (transaction.branded === 'tip') {
            // The same rule as the generic review, so a transfer's outcome cannot depend on which view shows it.
            // `to` is what is sent and what the collections set is keyed on (a collection's registry entry
            // is the template's, cloned at the requested address).
            if (!(await verifyCounterparties(transaction.call, transaction.chainId, transaction.to))) return
            if (isStale()) return
            try {
              const manaData = decodeManaTransferData(transaction.call)
              if (manaData) {
                const [recipientProfile, placeInfo] = await Promise.all([
                  fetchProfile(manaData.toAddress),
                  fetchPlaceByCreatorAddress(manaData.toAddress)
                ])
                if (isStale()) return
                setManaTransferData({
                  // Show the exact formatted amount (formatEther already trims trailing zeros).
                  manaAmount: `${manaData.manaAmount} MANA`,
                  toAddress: manaData.toAddress,
                  recipientProfile: recipientProfile || undefined,
                  sceneName: placeInfo?.sceneName || 'Unknown Place',
                  sceneImageUrl:
                    placeInfo?.sceneImageUrl ||
                    'https://peer.decentraland.org/content/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y'
                })
                setView(View.WALLET_MANA_INTERACTION)
                return
              }
            } catch (e) {
              if (isStale()) return
              console.error('Error building the branded tip view, falling back to the generic review', e)
            }
          }

          // The generic review is shown while the simulation runs, so Deny is available and Allow is
          // blocked from the first frame. A gift candidate is upgraded to the branded view only once
          // the simulation shows exactly the transfer it would display.
          setSimulationState({ status: 'loading' })
          setView(View.WALLET_INTERACTION)
          if (!transaction.relayed) {
            void estimateTransactionFee(transaction)
          }
          // The counterparty check and the simulation are independent, so they run side by side; the views
          // keep Allow blocked until both have settled.
          const verificationPromise = verifyCounterparties(transaction.call, transaction.chainId, transaction.to)
          const simulationPromise = fetchSimulation(buildSendTransactionSimulationPayload(transaction, signerAddress), transaction.call)

          if (transaction.branded !== 'gift_candidate') return
          const transferData = decodeNftTransferData(transaction.call)
          if (!transferData) return
          try {
            // A recognized selector is not a complete preview: keep the branded view only when the sole
            // visible effect is exactly the transfer it shows and nothing the request chose runs inside
            // it; anything else stays on the generic summary and its acknowledgment gates. The user may
            // also have answered from the generic review while the simulation ran; their answer stands.
            const [simulation, verified] = await Promise.all([simulationPromise, verificationPromise])
            if (isStale()) return
            if (!simulation || !verified || !isExactNftTransferSimulation(simulation, signerAddress, transaction.to, transferData)) {
              return
            }

            const [metadata, recipientProfile] = await Promise.all([
              fetchNftMetadata(transaction.to, transaction.contract.abi, transferData.tokenId),
              fetchProfile(transferData.toAddress)
            ])
            if (isStale()) return

            setNftTransferData({
              imageUrl: metadata.imageUrl,
              tokenId: transferData.tokenId,
              toAddress: transferData.toAddress,
              contractAddress: transaction.to,
              name: metadata.name,
              description: metadata.description,
              rarity: metadata.rarity,
              recipientProfile: recipientProfile || undefined
            })
            setView(View.WALLET_NFT_INTERACTION)
          } catch (e) {
            if (isStale()) return
            console.error('Error building the branded gift view, keeping the generic review', e)
          }
        }

        // The chain the wallet is on decides where a plain transaction executes and which registry
        // deployment its target is judged against, so it is read before classifying. The balance is
        // display only and must not block the review.
        let connectedChainId: number | undefined
        if (request.method === 'eth_sendTransaction') {
          const [currentChainId, userBalance] = await Promise.all([
            publicClient.getChainId(),
            publicClient.getBalance({ address: signerAddress }).catch(() => undefined)
          ])
          if (isStale()) return
          connectedChainId = currentChainId
          reviewedWalletChainIdRef.current = currentChainId
          setWalletInfo({ balance: userBalance, chainId: currentChainId })
        }

        // Decide once what this request is. Only a call to a Decentraland contract is previewed;
        // everything else is shown as exactly what it is, with a warning and an acknowledgment.
        const metaTransactionChainId = Number(getMetaTransactionChainId())
        const classified = await classifyRequest(request, {
          signerAddress,
          connectedChainId: connectedChainId ?? metaTransactionChainId,
          metaTransactionChainId,
          isAddressWithoutCode,
          resolveContract: (address, chainId) =>
            resolveKnownDecentralandContract(address, chainId, { metaTransactionChainId, isCollection: isDecentralandCollection })
        })
        if (isStale()) return
        classificationRef.current = classified
        setClassification(classified)
        trackEvent(TrackingEvents.REQUEST_CLASSIFIED, { requestId, ...describeClassification(classified) })

        switch (classified.kind) {
          case 'dcl_transaction':
            await reviewDecentralandTransaction(classified)
            break
          case 'dcl_meta_transaction': {
            // Preview the inner call the way the contract will make it — calling itself with the
            // connected signer appended — using the calldata the classifier proved the signature covers.
            setSimulationChainId(classified.chainId)
            setSimulationState({ status: 'loading' })
            setView(View.WALLET_SIGNATURE_INTERACTION)
            void verifyCounterparties(classified.call, classified.chainId, classified.contract.address)
            void fetchSimulation(
              buildMetaTransactionSimulationPayload(classified.chainId, classified.contract.address, classified.calldata, signerAddress),
              classified.call
            )
            break
          }
          case 'native_transfer':
          case 'unknown_transaction':
            // A plain send on the connected chain: nothing to preview, but the user pays gas.
            setView(View.WALLET_UNVERIFIED_INTERACTION)
            void estimateTransactionFee({
              to: classified.to,
              data: classified.kind === 'native_transfer' ? '0x' : classified.data,
              value: classified.value
            })
            break
          default:
            setView(View.WALLET_UNVERIFIED_INTERACTION)
        }
      } catch (e) {
        if (isStale()) return

        if (e instanceof DifferentSenderError) {
          // Not reported: the outcome endpoint does not check the sender, so answering here would
          // consume a request addressed to another account.
          setView(View.DIFFERENT_ACCOUNT)
          return
        } else if (e instanceof ExpiredRequestError) {
          setView(View.TIMEOUT)
          return
        } else if (e instanceof RequestFulfilledError) {
          // Request was already consumed successfully — not an error, stop re-fetching
          hasCompletedRef.current = true
          setView(View.WALLET_INTERACTION_COMPLETE)
          return
        } else if (e instanceof ImpersonatedSignInError) {
          // The request tried to sign a sign-in payload. Block it outright instead of
          // offering a retry that would re-trigger the same attack.
          await refuseRequest(e, 'impersonated_sign_in')
          return
        } else if (e instanceof MalformedSignatureRequestError || e instanceof MalformedTransactionRequestError) {
          // The params could preview one payload and sign or execute another, or the request is aimed at a
          // Decentraland contract but is not shaped the way the SDK builds one (see classifyRequest). Block
          // it; a retry recovers the same request.
          await refuseRequest(e, e instanceof MalformedTransactionRequestError ? 'malformed_transaction' : 'malformed_signature')
          return
        } else if (e instanceof UnsupportedMethodError) {
          // The request used a method that is not on the allowlist. Block it outright — a retry
          // would re-trigger the same rejection. A client still on the retired sign-in method
          // gets the "update your app" view instead of a generic error whose retry cannot work.
          hasCompletedRef.current = true
          setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
          setView(isRetiredSignInMethod(e.method) ? View.OUTDATED_CLIENT : View.LOADING_ERROR)
          await reportRejectedRequest(RPC_METHOD_NOT_SUPPORTED, e.message)
          return
        } else if (e instanceof ContractLookupUnavailableError) {
          // Whether the target is a Decentraland collection could not be checked. Reading that as
          // "not Decentraland" would send Polygon calldata as a plain transaction on whatever chain
          // the wallet is on, or show a MetaTransaction for a Decentraland collection as one for a
          // contract Decentraland does not know, so the request is neither reviewed nor answered.
          // The request is still there, so its view retries the review here (see LookupUnavailableError)
          // instead of sending the user back to the app for a new one.
          setView(View.LOOKUP_UNAVAILABLE)
          return
        }

        // Not reported either: an expired, fulfilled or missing request has nothing left to answer,
        // and any other failure is retryable through the error view.
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.LOADING_ERROR)
      }
    }

    if (isDeepLinkFlow) {
      completeClientLoginFlow()
    } else {
      // Every load produces a review of its own, so every load takes a new token — the key-change reset
      // above does not cover a reload for the same request and account.
      reviewRunRef.current += 1
      if (!isNewRequest) {
        // The load is running again for the same request and the same account — an embedded wallet handed
        // the app a new provider object, the profile became ready — and it recovers, reclassifies and
        // re-simulates from scratch. The reset above is keyed to the request and the account, so it does
        // not run for this, and everything the previous run derived would stay on screen and stay
        // actionable while the fresh one works: a confirmation dialog opened a moment ago would still
        // confirm, and Allow would still read a settled preview and a counterparty verdict belonging to
        // the run before it. So the review is put back to "being decided" for as long as that takes.
        // Not a reset: `hasCompletedRef` and the settle state are the request's, not this run's, and an
        // answered or expired request must stay answered.
        setIsTransactionModalOpen(false)
        setSimulationState(current => (current.status === 'loading' ? current : { status: 'loading' }))
        setAreCounterpartiesVerified(false)
        setSimulationVerified(current => (current.length === 0 ? current : []))
        setSimulationCollections(current => (current.length === 0 ? current : []))
        setSimulationProfiles(current => (Object.keys(current).length === 0 ? current : {}))
        // Everything else the previous run derived goes too, and the page says it is deciding again. Each
        // of these already blocked approval on its own — an unsettled preview, an unverified counterparty
        // set, an acknowledgment whose statement no longer matches — but only as a side effect of what it
        // happens to gate. Dropping them says it once: no part of the previous review is on screen or
        // actionable while its replacement is being worked out.
        setClassification(null)
        classificationRef.current = null
        setGasEstimate(null)
        setNftTransferData(null)
        setManaTransferData(null)
        setView(View.LOADING_REQUEST)
      }
      loadRequest()
    }

    return () => {
      cancelled = true
      clearTimeout(timeoutRef.current)
    }
  }, [
    toLoginPage,
    account,
    provider,
    providerType,
    isConnecting,
    initializedFlags,
    isProfileReady,
    requestId,
    isDeepLinkFlow,
    isInvalidDeepLinkId,
    skipSetup,
    reviewAttempt
  ])

  useEffect(() => {
    // The timeout is only necessary on the wallet interaction views.
    // We can clear it out when the user is shown another view to prevent the timeout from triggering somewhere not intended.
    if (!INTERACTION_VIEWS.has(view)) {
      clearTimeout(timeoutRef.current)
    }
  }, [view])

  // Which completion view applies depends on the branded flow the request turned out to be.
  const showInteractionCompleteView = useCallback(() => {
    if (nftTransferData) {
      setView(View.WALLET_NFT_INTERACTION_COMPLETE)
    } else if (manaTransferData) {
      setView(View.WALLET_MANA_INTERACTION_COMPLETE)
    } else {
      setView(View.WALLET_INTERACTION_COMPLETE)
    }
  }, [nftTransferData, manaTransferData])

  const onDenyWalletInteraction = useCallback(async () => {
    // Only the request this page recovered can be answered. If the route has moved on to another id,
    // nothing has been reviewed for it yet.
    if (recoveredRequestIdRef.current !== requestId) return
    // One answer per request: not while Allow or an earlier Deny is in flight, and not once the request
    // has been answered or has expired. Checked and set before the first await (see isSettlingRef).
    if (isSettlingRef.current || hasCompletedRef.current) return
    isSettlingRef.current = true
    // The review this answer belongs to. Once the page has moved on to another request or account, the
    // outcome already sent stands, but nothing here may touch the review now on screen.
    const generation = reviewGenerationRef.current
    const isStaleAction = () => reviewGenerationRef.current !== generation
    // The account that reviewed this request, fixed now: the ref moves on to the next review's account while
    // this answer is in flight, and an outcome must never be compared with or delivered under that one.
    const reviewedSigner = recoveredSignerRef.current
    // The decision is final the moment the user clicks: mark completion before the outcome
    // round-trip so nothing that resolves in the meantime (e.g. a late simulation rejection)
    // can override the denied view or answer the request a second time.
    hasCompletedRef.current = true
    setIsLoading(true)
    setIsTransactionModalOpen(false)
    trackClick(ClickEvents.DENY_WALLET_INTERACTION)

    try {
      if (walletClientRef.current) {
        const [address] = await walletClientRef.current.getAddresses()
        if (isStaleAction()) return
        if (address.toLowerCase() !== reviewedSigner) {
          // The wallet's active account is no longer the one that recovered and reviewed this
          // request, so it has nothing to answer for it. Undo the early completion mark, say what
          // happened, and leave the rest to the load effect starting over for the new account.
          hasCompletedRef.current = false
          setIsLoading(false)
          setView(View.DIFFERENT_ACCOUNT)
          return
        }
        await authServerClient.current.sendFailedOutcome(requestId, address, {
          code: -32003,
          message: 'Transaction rejected'
        })
      }
    } catch (error) {
      console.error('Failed to send denied notification:', error)
    } finally {
      if (!isStaleAction()) isSettlingRef.current = false
    }
    if (isStaleAction()) return

    setIsLoading(false)
    // Set appropriate view based on whether it's an NFT transfer or MANA transfer
    if (nftTransferData) {
      setView(View.WALLET_NFT_INTERACTION_DENIED)
    } else if (manaTransferData) {
      setView(View.WALLET_MANA_INTERACTION_DENIED)
    } else {
      setView(View.WALLET_INTERACTION_DENIED)
    }
  }, [nftTransferData, manaTransferData, requestId])

  const restartReview = useCallback(
    (reason: ReviewRestartReason, { notice = true }: { notice?: boolean } = {}) => {
      // Make the stale review non-actionable immediately, then let the load effect's existing reset
      // clear every derived preview/classification and recover the same request again. No outcome is
      // sent: a missing, changed, or temporarily unreadable chain says nothing about the user's
      // decision and the request must remain available for the fresh review. The restart is neither
      // silent nor invisible: it is reported so the frequency of a security-relevant invalidation is
      // visible in production, and the re-reviewed page says why it reloaded, so an Allow that seems
      // not to take is explained. A restart the user asked for (Try Again after a lookup could not
      // complete) is tracked the same way but needs no notice: they know why the page reloaded.
      trackEvent(TrackingEvents.TRANSACTION_REVIEW_RESTARTED, { requestId, reason })
      pendingReviewRestartRef.current = notice ? reason : undefined
      recoveredRequestIdRef.current = undefined
      reviewedWalletChainIdRef.current = undefined
      loadedRequestIdRef.current = undefined
      setLoadedRequestId(undefined)
      setView(View.LOADING_REQUEST)
      setReviewAttempt(attempt => attempt + 1)
    },
    [requestId]
  )

  const onApproveWalletInteraction = useCallback(async () => {
    // Only the request this page recovered can be executed. If the route has moved on to another
    // id, requestRef still holds the previous request and its outcome would be reported under the
    // new id; nothing reviewed exists for the new one yet.
    if (recoveredRequestIdRef.current !== requestId) return
    // One answer per request: not while Deny or an earlier Allow is in flight (the buttons are not
    // disabled synchronously, so a double click or opposing clicks could otherwise re-enter before
    // React flips isLoading), and not once the request has been answered or has expired. Checked and
    // set before the first await (see isSettlingRef).
    if (isSettlingRef.current || hasCompletedRef.current) return
    // Every gate the review is subject to, enforced here rather than trusted to whichever button was
    // pressed. The Allow buttons render the same value, so in the ordinary case this changes nothing; what
    // it stops is a press that reaches this handler while the gates do not hold — the confirmation dialog
    // web2 users get, whose own button knows only whether an approval is already running, still open when
    // a re-review began behind it (see isReviewActionable).
    if (!isReviewActionableRef.current) return
    isSettlingRef.current = true
    // The review this action belongs to. Once the page has moved on to another request or account, the
    // wallet result and its outcome delivery still complete for the request that was reviewed, but nothing
    // here may touch the review now on screen or its settle state.
    const generation = reviewGenerationRef.current
    const isStaleAction = () => reviewGenerationRef.current !== generation
    // And the review it was clicked on. A load that runs again for the same request and account leaves the
    // generation alone by design, so this is what tells that review from the one that replaced it.
    const run = reviewRunRef.current
    // Whether the request may still be signed or sent, re-read after every await that precedes a dispatch.
    // Each of those awaits is a window: the expiration timer can fire in it (which settles the request and
    // shows the timeout screen without moving the generation, so `isStaleAction` alone does not see it),
    // a re-review can begin and even finish in it — which is why the run is checked as well as the gates,
    // since the gates are shared and a settled replacement makes them true again, while only the run says
    // whether they are true for the review this click was given to. Never consulted after a dispatch — past
    // that point the transaction is broadcast or the payload is signed, and the outcome must still be
    // delivered whatever has happened to the review (see hasWalletResult).
    const canStillDispatch = () =>
      !isStaleAction() && reviewRunRef.current === run && !hasCompletedRef.current && isReviewActionableRef.current
    // The account that reviewed this request, fixed now. The ref moves on to the next review's account
    // while this action is in flight; every comparison and every outcome below uses this value, never the
    // ref, so a late rejection can neither pass the check against another account nor be delivered under it.
    const reviewedSigner = recoveredSignerRef.current
    setIsLoading(true)
    setIsTransactionModalOpen(false)
    const walletClient = walletClientRef.current
    // Answers the request as failed for the account that reviewed it, or not at all. After async wallet
    // work the wallet's active account is read again: if it is no longer the reviewing account, nothing
    // is sent, because the outcome endpoint does not check the sender and the reviewed request would be
    // consumed as a rejection from an account that never saw it. The caller then shows the account-change
    // view and leaves the request for the fresh review the load effect starts.
    const reportFailedOutcomeForReviewedSigner = async (error: OutcomeError): Promise<'sent' | 'other_account' | 'unsent'> => {
      if (!walletClient || !reviewedSigner) return 'unsent'
      const [currentAddress] = await walletClient.getAddresses()
      if (currentAddress.toLowerCase() !== reviewedSigner) return 'other_account'
      // The wallet's own spelling of the reviewing account, as every other outcome sends it.
      await authServerClient.current.sendFailedOutcome(requestId, currentAddress, error)
      return 'sent'
    }
    // Flips once the wallet has executed the request. Past that point the action is irreversible —
    // the transaction is broadcast, or the payload is signed — so any later failure is a delivery
    // problem, never a rejection. See the catch below.
    let hasWalletResult = false
    try {
      if (!walletClient) {
        throw new Error('Provider not created')
      }

      if (!requestRef.current?.method) {
        throw new Error('Method not found')
      }

      const [signerAddress] = await walletClient.getAddresses()
      if (!canStillDispatch()) return
      if (signerAddress.toLowerCase() !== reviewedSigner) {
        // The wallet's active account is no longer the one that recovered and reviewed this request.
        // Executing here would run the reviewed request from an account that never saw it. Say what
        // happened rather than silently doing nothing: a wallet that never reports the switch would
        // otherwise leave the reviewed request on screen with an Allow that does nothing. The load
        // effect starts over if and when the connection reports the new account; the finally block
        // clears the loading state.
        setView(View.DIFFERENT_ACCOUNT)
        return
      }
      const method = requestRef.current.method
      // Dispatch on what was reviewed, never on a fresh reading of the request.
      const reviewed = classificationRef.current
      if (!reviewed) {
        throw new Error('Request not classified')
      }

      let result: string | null = null

      if (reviewed.kind === 'dcl_transaction' && reviewed.relayed) {
        // Relayed through the gas tank as a meta-transaction on the meta-transaction chain. The
        // registry entry is the classified contract's, at the address the request calls: a wearable
        // collection is a per-deployment proxy of the ERC721CollectionV2 template.
        const connectedProvider = await getConnectedProvider()
        if (!connectedProvider) {
          throw new Error('Provider not connected')
        }
        const networkProvider = await getNetworkProvider(reviewed.chainId as ChainId)
        if (!canStillDispatch()) return
        const contract = {
          abi: reviewed.contract.abi as unknown as object[],
          address: reviewed.to,
          name: reviewed.contract.domainName,
          version: reviewed.contract.domainVersion,
          chainId: reviewed.chainId as ChainId
        }
        // The library reads the active account again and signs and submits for whatever it gets back.
        // Bound to the signer verified above, it can only act for the account that reviewed the request;
        // a wallet that switched accounts in between fails with ReviewedSignerMismatchError (see catch).
        result = await sendMetaTransaction(
          bindProviderToSigner(connectedProvider, signerAddress),
          networkProvider,
          reviewed.data,
          contract,
          {
            serverURL: `${config.get('META_TRANSACTION_SERVER_URL')}/v1`
          }
        )
      } else if (reviewed.kind === 'dcl_transaction' || reviewed.kind === 'unknown_transaction' || reviewed.kind === 'native_transfer') {
        // A plain send on the connected chain, of exactly the fields that were reviewed and fingerprinted:
        // the classification's, never a fresh reading of the request.
        const transactionParams = {
          to: reviewed.to,
          data: reviewed.kind === 'native_transfer' ? '0x' : reviewed.data,
          value: reviewed.value
        }
        const reviewedChainId = reviewedWalletChainIdRef.current
        const currentChainId = await publicClientRef.current?.getChainId().catch(() => undefined)
        if (!canStillDispatch()) return
        if (reviewedChainId === undefined || currentChainId !== reviewedChainId) {
          // The address and calldata may refer to entirely different code on another chain, and
          // an unreadable chain cannot be compared safely. Discard the stale review and recover
          // the still-unconsumed request so it is previewed on a verified live chain.
          restartReview(
            reviewedChainId === undefined ? 'network_unrecorded' : currentChainId === undefined ? 'network_unreadable' : 'network_changed'
          )
          return
        }
        result = await walletClient.request({
          method: 'eth_sendTransaction',
          // Also bind the request to the reviewed chain. This is defense in depth for injected
          // wallets, which validate the standard JSON-RPC chainId and refuse a last-moment switch
          // between the check above and the send instead of broadcasting on the new chain (that
          // refusal is routed back into the review, see the catch). Embedded wallets (Magic,
          // Thirdweb) ignore it, so for them the check above is the whole guard, and it is enough:
          // their chain is not something a user or another site can switch. It changes only through
          // `wallet_switchEthereumChain` on the connector this app holds (Thirdweb rebuilds its
          // provider on the new chain, Magic re-instantiates its SDK), nothing outside this app can
          // reach that connector, and this page never switches it while a review is open. With no
          // actor able to move the chain between the read and the send, the read is the send's chain.
          params: [{ ...transactionParams, from: signerAddress, chainId: `0x${reviewedChainId.toString(16)}` }]
        })
      } else {
        // Signatures carry no `to` address and are never relayed. The wallet is handed the reviewed bytes
        // themselves, never a fresh reading of the request, in the exact shape its schema gives the method
        // (see toWalletSignatureRequest).
        result = await forwardSignatureRequest(walletClient, toWalletSignatureRequest(method, reviewed, signerAddress))
      }

      hasWalletResult = true

      trackClick(ClickEvents.APPROVE_WALLET_INTERACTION, {
        method: requestRef.current?.method
      })
      await authServerClient.current.sendSuccessfulOutcome(requestId, signerAddress, result)
      if (isStaleAction()) return
      hasCompletedRef.current = true

      // A side effect of an outcome the server has already accepted, so its failure is its own
      // concern: report it under its own context rather than as an outcome-delivery problem, and
      // complete either way.
      if (manaTransferData && result && identity) {
        try {
          await sendTipNotification(identity, result)
        } catch (notificationError) {
          handleError(notificationError, 'Error sending the tip notification')
        }
        if (isStaleAction()) return
      }
      showInteractionCompleteView()
    } catch (e) {
      // Every branch reports, then shows the result. Reporting (Sentry, the failed outcome) belongs to the
      // reviewed request and goes ahead; showing belongs to the review on screen and is skipped once this
      // action is stale.
      if (hasWalletResult) {
        // The wallet already executed the request; only the delivery of its outcome failed.
        // Reporting a failed outcome here would tell the client the user rejected a transaction
        // that is already on-chain, and the error view would invite them to send it a second time.
        // Neither is true, so surface completion and leave the request for the server to expire.
        // An expected race (RequestFulfilledError, which carries skipReporting) is swallowed by
        // handleError, so it lands on the same completion view without Sentry noise.
        handleError(e, 'Error delivering the outcome of an executed wallet interaction', {
          sentryTags: { isWeb2Wallet: isUserUsingWeb2Wallet }
        })
        if (isStaleAction()) return
        hasCompletedRef.current = true
        showInteractionCompleteView()
      } else if (e instanceof ReviewedSignerMismatchError) {
        // The wallet's active account changed between the check above and the relay's own account
        // read, so nothing was signed or submitted. Not the user's decision: no outcome, say what
        // happened, and let the load effect start over for the new account.
        if (isStaleAction()) return
        setView(View.DIFFERENT_ACCOUNT)
      } else if (isChainMismatchRejection(e)) {
        // The wallet refused the send because its network no longer matches the reviewed chain: the
        // binding above fired. That is not the user's decision, so answer nothing and review again.
        if (isStaleAction()) return
        restartReview('wallet_rejected_chain')
      } else if (isUserRejectedTransaction(e)) {
        console.info('User rejected wallet interaction in wallet — not reporting to Sentry')
        let delivery: 'sent' | 'other_account' | 'unsent' = 'unsent'
        try {
          delivery = await reportFailedOutcomeForReviewedSigner({ code: -32003, message: 'Transaction rejected' })
        } catch (failedOutcomeError) {
          console.error('Failed to send denied notification:', failedOutcomeError)
        }
        if (isStaleAction()) return
        if (delivery === 'other_account') {
          setView(View.DIFFERENT_ACCOUNT)
          return
        }
        hasCompletedRef.current = true
        if (nftTransferData) {
          setView(View.WALLET_NFT_INTERACTION_DENIED)
        } else if (manaTransferData) {
          setView(View.WALLET_MANA_INTERACTION_DENIED)
        } else {
          setView(View.WALLET_INTERACTION_DENIED)
        }
      } else if (e instanceof RequestFulfilledError) {
        // The request was already fulfilled (e.g. another tab completed it, or it executed and the
        // outcome delivery raced). It succeeded — show completion instead of attempting a failed
        // outcome and reporting an expected state as an error.
        if (isStaleAction()) return
        hasCompletedRef.current = true
        showInteractionCompleteView()
      } else {
        handleError(e, 'Wallet interaction error', {
          sentryTags: { isWeb2Wallet: isUserUsingWeb2Wallet }
        })

        // Try to send failed outcome, but don't let it prevent showing the error view
        let delivery: 'sent' | 'other_account' | 'unsent' = 'unsent'
        try {
          delivery = await reportFailedOutcomeForReviewedSigner(
            isRpcError(e) ? e.error : { code: 999, message: isErrorWithMessage(e) ? e.message : 'Unknown error' }
          )
        } catch (failedOutcomeError) {
          console.error('Failed to send failed outcome:', failedOutcomeError)
        }
        if (isStaleAction()) return
        if (delivery === 'other_account') {
          setView(View.DIFFERENT_ACCOUNT)
          return
        }

        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setErrorKind('wallet_error')
        setView(View.WALLET_INTERACTION_ERROR)
      }
    } finally {
      // The review on screen owns its loading and settle state; a stale action leaves both alone.
      if (!isStaleAction()) {
        setIsLoading(false)
        isSettlingRef.current = false
      }
    }
  }, [isUserUsingWeb2Wallet, nftTransferData, manaTransferData, requestId, identity, showInteractionCompleteView, restartReview])

  // Allow, on every review: web2 users get a confirmation dialog first, since their wallet has no
  // prompt of its own; external wallets go straight to theirs.
  const handleApproveWalletInteraction = useCallback(async () => {
    if (isUserUsingWeb2Wallet) {
      setIsTransactionModalOpen(true)
    } else {
      await onApproveWalletInteraction()
    }
  }, [isUserUsingWeb2Wallet, onApproveWalletInteraction])

  const onContinueInApp = useCallback(() => {
    if (!identityId) return

    // Track the open once — the client-login view stays mounted and may re-launch the deep
    // link (return button or retry), which must not re-count the event.
    if (!hasTrackedDeepLinkRef.current) {
      hasTrackedDeepLinkRef.current = true
      // Carry the route UUID (the client's correlation id) so the open can be tied in analytics
      // to the instance that requested the login.
      trackClick(ClickEvents.IDENTITY_DEEP_LINK_OPENED, { authRequestId: requestId })
    }
    // The client was opened via the deep link and there is nothing to navigate to — stay on
    // the ContinueInApp view, which doubles as the retry fallback.
  }, [identityId, trackClick, requestId])

  const onRetryClientLogin = useCallback(() => {
    // A fresh mount re-runs completeClientLoginFlow: the view resets to LOADING_REQUEST and
    // the in-flight promise ref clears, re-posting the identity with the still-cached login.
    window.location.reload()
  }, [])

  const isDecentralandRequest = classification !== null && isDecentralandClassification(classification)
  const isSimulationReverted = simulationState.status === 'ready' && simulationState.result.status === 'reverted'
  // The simulation resolved and grants a permission the user should not approve on a single click
  // (see isDangerousApproval). Spenders are recognized from the same chain-aware verified set the
  // summary uses for its badge and warning, so the checkbox and the icon always agree.
  const hasDangerousApprovalChange =
    simulationState.status === 'ready' &&
    simulationState.result.approvalChanges.some(approval =>
      isDangerousApproval(approval, address => simulationVerified.includes(address.toLowerCase()))
    )
  // The preview ran and shows the user nothing to check: no asset moving into or out of the account
  // and no permission change (see hasNoVisibleEffects). A call can still change state the summary
  // does not model — an update operator on LAND, a collection's minters, managers or creator, a
  // name's resolver — so "nothing to show" is not "nothing happens" and must not be a single click.
  const hasPreviewWithoutVisibleEffects =
    simulationState.status === 'ready' && hasNoVisibleEffects(simulationState.result, reviewedSignerAddress ?? '')
  // A MetaTransaction signature whose inner call could not be previewed: the simulation was
  // unavailable, or the call reverts today. Unlike an eth_sendTransaction relayed through the gas
  // tank — which Auth signs and submits in one step, so the signature is consumed the moment it is
  // made — a signed MetaTransaction is handed back to the requester as a bearer authorization: it
  // has no expiry and anyone holding it can submit it until the nonce is used. A call that reverts
  // now can therefore be relayed once the state changes, so "would fail" is not a safe preview.
  const isSignatureWithoutVerifiedEffects =
    classification?.kind === 'dcl_meta_transaction' && (simulationState.status === 'unavailable' || isSimulationReverted)
  // Anything that is not a Decentraland contract call is acknowledged, always. A Decentraland call
  // is acknowledged when: (a) the simulation shows a high-risk permission; (b) the simulation could
  // NOT be produced, so the effects can't be shown — this holds even for a relayed call, because a
  // gas-covered relay still executes whatever call it is handed; (c) a signed MetaTransaction has no
  // verified effects; or (d) the preview ran but shows no change the user can check.
  const requiresApprovalAcknowledgment =
    classification !== null &&
    (!isDecentralandRequest ||
      hasDangerousApprovalChange ||
      hasPreviewWithoutVisibleEffects ||
      simulationState.status === 'unavailable' ||
      isSignatureWithoutVerifiedEffects)

  // Derived, not synced: on the render where the route id or the account changes, every piece of
  // state still belongs to the previous review. Show none of it — no summary, no Allow — until this
  // instance has started loading the current id for the current account, which the load effect
  // records together with its reset.
  const renderedView = loadedRequestId === requestId && loadedAccount === account ? view : View.LOADING_REQUEST

  // A typed-data payload's fingerprint is its whole JSON, so it is computed once per classification.
  const payloadFingerprint = useMemo(() => (classification ? getPayloadFingerprint(classification) : ''), [classification])
  // The exact screen the user is asked to acknowledge, folded into one string: this request, this payload,
  // the preview's outcome and contents, and every notice shown next to them. A tick counts for that string
  // only, so anything that changes what is on screen — another request, a re-simulation that showed
  // something else, a different reason for asking — stops it counting and the review asks again (see
  // useAcknowledgment). One statement for every view rather than one composed inside each: a view whose
  // statement left out something it displayed would carry a tick across a change the user never saw.
  const acknowledgmentStatement = useMemo(
    () =>
      [
        requestId,
        classification?.kind ?? '',
        payloadFingerprint,
        simulationState.status,
        isSimulationReverted ? 'reverted' : '',
        hasPreviewWithoutVisibleEffects ? 'no-visible-effects' : '',
        isSignatureWithoutVerifiedEffects ? 'unverified' : '',
        getPreviewFingerprint(simulationState.status === 'ready' ? simulationState.result : undefined)
      ].join('|'),
    [
      requestId,
      classification?.kind,
      payloadFingerprint,
      simulationState,
      isSimulationReverted,
      hasPreviewWithoutVisibleEffects,
      isSignatureWithoutVerifiedEffects
    ]
  )
  const { acknowledged: isAcknowledged, setAcknowledged } = useAcknowledgment(acknowledgmentStatement)

  // The wallet-side fee estimate a transaction the user pays gas for waits on, so the cost is always seen
  // before sending. A relayed call and a signature cost nothing and never wait for it.
  const isGasEstimatePending = gasEstimate === null || gasEstimate.status === 'loading'

  // The one place that decides whether the review on screen may be acted on: its preview has settled, the
  // contracts its call reaches have been checked, the fee is known where the user pays it, and any required
  // acknowledgment was given for this exact screen. The Allow buttons render it and the approval handler
  // enforces it, so nothing can approve a review whose gates have not cleared — not a confirmation dialog
  // opened a moment before a re-review began, whose own button knows nothing about them, and not an Allow
  // whose preparation outlived the review it started from.
  //
  // `isLoading` is deliberately not part of it: that says an approval is already running, which is the
  // handler's own re-entry guard (isSettlingRef), not a property of the review. A view keeps a gate of its
  // own only for what it alone can measure (a long message scrolled to its end).
  const isReviewActionable = (() => {
    if (classification === null) return false
    const isPreviewSettled = simulationState.status === 'ready' || simulationState.status === 'unavailable'
    const isAcknowledgedIfNeeded = !requiresApprovalAcknowledgment || isAcknowledged
    switch (renderedView) {
      case View.WALLET_INTERACTION:
        return (
          classification.kind === 'dcl_transaction' &&
          isPreviewSettled &&
          areCounterpartiesVerified &&
          (classification.relayed || !isGasEstimatePending) &&
          isAcknowledgedIfNeeded
        )
      case View.WALLET_SIGNATURE_INTERACTION:
        return classification.kind === 'dcl_meta_transaction' && isPreviewSettled && areCounterpartiesVerified && isAcknowledgedIfNeeded
      case View.WALLET_UNVERIFIED_INTERACTION:
        // Nothing is previewed here, so there is no preview to settle, and the acknowledgment is always
        // required (see UnverifiedRequestView).
        return (!isTransactionClassification(classification) || !isGasEstimatePending) && isAcknowledged
      // A branded screen stands in for the generic review only once that review's checks passed (see
      // reviewDecentralandTransaction), so it carries the same counterparty requirement.
      case View.WALLET_NFT_INTERACTION:
        return nftTransferData !== null && areCounterpartiesVerified
      case View.WALLET_MANA_INTERACTION:
        return manaTransferData !== null && areCounterpartiesVerified
      default:
        return false
    }
  })()
  isReviewActionableRef.current = isReviewActionable
  const approveBlocked = isLoading || !isReviewActionable

  // What the confirmation dialog says the request will cost: covered by the relay, or the wallet's own
  // estimate for a plain send. Signatures are gasless and show no line.
  const isTransactionRequest = classification !== null && isTransactionClassification(classification)
  const isPlainSend = isTransactionRequest && !(classification.kind === 'dcl_transaction' && classification.relayed)
  const confirmGas: ConfirmRequestGas | undefined =
    classification?.kind === 'dcl_transaction' && classification.relayed
      ? { covered: true }
      : isPlainSend
        ? gasEstimate?.status === 'ready'
          ? { covered: false, status: 'ready', cost: gasEstimate.cost, chainId: classification.chainId }
          : gasEstimate?.status === 'unavailable'
            ? { covered: false, status: 'unavailable' }
            : { covered: false, status: 'loading' }
        : undefined
  const confirmDialog = (
    <ConfirmRequestDialog
      open={isTransactionModalOpen}
      kind={isTransactionRequest ? 'transaction' : 'signature'}
      gas={confirmGas}
      isLoading={isLoading}
      onCancel={() => setIsTransactionModalOpen(false)}
      onConfirm={onApproveWalletInteraction}
    />
  )

  switch (renderedView) {
    case View.TIMEOUT:
      return <TimeoutError requestId={requestId} />
    case View.DIFFERENT_ACCOUNT:
      return <DifferentAccountError requestId={requestId} />
    case View.LOADING_ERROR:
      return (
        <RecoverError
          onTryAgain={() => {
            window.location.href = getExplorerDeeplink(targetConfig.deepLink, isBridgeOnly, authRequestId)
          }}
        />
      )
    case View.WALLET_INTERACTION_ERROR:
      return <SigningError error={error} kind={errorKind ?? undefined} />
    case View.LOOKUP_UNAVAILABLE:
      return <LookupUnavailableError onTryAgain={() => restartReview('lookup_unavailable', { notice: false })} />
    case View.CLIENT_LOGIN_ERROR:
      return <ClientLoginError error={error} onTryAgain={onRetryClientLogin} />
    case View.OUTDATED_CLIENT:
      return <OutdatedClientError explorerText={targetConfig.explorerText} />
    case View.DEEP_LINK_CONTINUE_IN_APP:
      return (
        <ContinueInApp
          onContinue={onContinueInApp}
          requestId={requestId}
          // The route's UUID v4 is the client's correlation id: forward it to the client as the
          // deep link's `authRequestId` so it can match this login to the instance that requested it.
          deepLinkUrl={getSigninDeeplink(targetConfig.deepLink, identityId ?? '', isBridgeOnly, requestId)}
          isClientLogin={isDeepLinkFlow}
        />
      )
    case View.WALLET_INTERACTION_COMPLETE:
      return <WalletInteractionComplete />
    case View.WALLET_NFT_INTERACTION_COMPLETE:
      return nftTransferData ? <TransferCompletedView type={TransferType.GIFT} transferData={nftTransferData} /> : null
    case View.WALLET_MANA_INTERACTION_COMPLETE:
      return manaTransferData ? <TransferCompletedView type={TransferType.TIP} transferData={manaTransferData} /> : null
    case View.WALLET_INTERACTION_DENIED:
      return <DeniedWalletInteraction />
    case View.WALLET_NFT_INTERACTION_DENIED:
      return nftTransferData ? <TransferCanceledView type={TransferType.GIFT} transferData={nftTransferData} /> : null
    case View.WALLET_MANA_INTERACTION_DENIED:
      return manaTransferData ? <TransferCanceledView type={TransferType.TIP} transferData={manaTransferData} /> : null
    case View.LOADING_REQUEST:
      return <LoadingRequest />

    case View.WALLET_NFT_INTERACTION:
      return nftTransferData ? (
        <>
          {confirmDialog}
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={nftTransferData}
            isLoading={isLoading}
            approveBlocked={approveBlocked}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      ) : null
    case View.WALLET_MANA_INTERACTION:
      return manaTransferData ? (
        <>
          {confirmDialog}
          <TransferConfirmView
            type={TransferType.TIP}
            transferData={manaTransferData}
            isLoading={isLoading}
            approveBlocked={approveBlocked}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      ) : null
    case View.WALLET_INTERACTION: {
      if (classification?.kind !== 'dcl_transaction') return null
      const gas = classification.relayed
        ? ({ covered: true } as const)
        : gasEstimate?.status === 'ready'
          ? ({ covered: false, status: 'ready', cost: gasEstimate.cost, balance: walletInfo?.balance } as const)
          : gasEstimate?.status === 'unavailable'
            ? ({ covered: false, status: 'unavailable' } as const)
            : ({ covered: false, status: 'loading' } as const)
      return (
        <>
          {confirmDialog}
          <WalletInteraction
            key={requestId}
            requestId={requestId}
            functionName={classification.call.functionName}
            contractName={classification.contract.domainName}
            isLoading={isLoading}
            simulation={simulationState}
            userAddress={reviewedSignerAddress ?? ''}
            profiles={simulationProfiles}
            verifiedContracts={simulationVerified}
            collectionContracts={simulationCollections}
            chainId={simulationChainId}
            requiresAcknowledgment={requiresApprovalAcknowledgment}
            acknowledged={isAcknowledged}
            approveBlocked={approveBlocked}
            gas={gas}
            isReverted={isSimulationReverted}
            reviewRestarted={reviewRestartReason !== null}
            onAcknowledgedChange={setAcknowledged}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      )
    }
    case View.WALLET_SIGNATURE_INTERACTION:
      if (classification?.kind !== 'dcl_meta_transaction') return null
      return (
        <>
          {confirmDialog}
          <SignatureRequestView
            key={requestId}
            requestId={requestId}
            method={requestRef.current?.method ?? ''}
            raw={classification.raw}
            verifyingContract={classification.contract.address}
            functionName={classification.call.functionName}
            contractName={classification.contract.domainName}
            simulation={simulationState}
            userAddress={reviewedSignerAddress ?? ''}
            profiles={simulationProfiles}
            verifiedContracts={simulationVerified}
            collectionContracts={simulationCollections}
            chainId={simulationChainId}
            requiresAcknowledgment={requiresApprovalAcknowledgment}
            acknowledged={isAcknowledged}
            approveBlocked={approveBlocked}
            isLoading={isLoading}
            onAcknowledgedChange={setAcknowledged}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      )
    case View.WALLET_UNVERIFIED_INTERACTION: {
      const unverified = classification ? getUnverifiedRequestProps(classification) : null
      if (!classification || !unverified) return null
      const isTransactionKind = isTransactionClassification(classification)
      return (
        <>
          {confirmDialog}
          <UnverifiedRequestView
            key={requestId}
            requestId={requestId}
            method={requestRef.current?.method ?? ''}
            {...unverified}
            gas={isTransactionKind ? (gasEstimate ?? { status: 'loading' }) : undefined}
            balance={isTransactionKind ? walletInfo?.balance : undefined}
            acknowledged={isAcknowledged}
            approveBlocked={approveBlocked}
            isLoading={isLoading}
            reviewRestarted={reviewRestartReason !== null}
            onAcknowledgedChange={setAcknowledged}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      )
    }
    default:
      return null
  }
}
