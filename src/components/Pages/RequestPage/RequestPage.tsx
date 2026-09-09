import { useCallback, useContext, useEffect, useRef, useState } from 'react'
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
import { fetchProfile } from '../../../modules/profile'
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
  UnsupportedMethodError,
  bindProviderToSigner,
  buildMetaTransactionSimulationPayload,
  createAuthServerHttpClient,
  getKnownDecentralandContract,
  hasNoVisibleEffects,
  isDangerousApproval,
  resolveKnownDecentralandContract
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
import { GasEstimateState, MANATransferData, NFTTransferData, PreviewCaveat, SimulationState, TransferType } from './types'
import {
  buildSendTransactionSimulationPayload,
  decodeManaTransferData,
  decodeNftTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  getCallbackRecipient,
  getConnectedProvider,
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
import { ConfirmRequestGas } from './Views/ConfirmRequestDialog'
import { UnverifiedRequestViewProps } from './Views/UnverifiedRequest'
import { forwardSignatureRequest, toWalletSignatureRequest } from './walletSignatureRequest'

enum View {
  TIMEOUT,
  DIFFERENT_ACCOUNT,
  // Loading
  LOADING_REQUEST,
  LOADING_ERROR,
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

// Why a transaction review was discarded and started over (see restartTransactionReview).
type ReviewRestartReason = 'network_changed' | 'network_unreadable' | 'network_unrecorded' | 'wallet_rejected_chain'

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
  // Why the simulation of the reviewed call cannot be vouched for even when it ran (see PreviewCaveat).
  // Decided before the simulation is fetched, so Allow never enables on a preview the page would not stand behind.
  const [previewCaveat, setPreviewCaveat] = useState<PreviewCaveat | null>(null)
  // Resolved counterparty display names (lowercased address → name), filled in progressively.
  const [simulationProfiles, setSimulationProfiles] = useState<Record<string, string>>({})
  // Chain the pending transaction/meta-tx was simulated on, for block-explorer links.
  const [simulationChainId, setSimulationChainId] = useState<number>()
  // Lowercased addresses in the simulation that are recognized Decentraland contracts.
  const [simulationVerified, setSimulationVerified] = useState<string[]>([])
  const requestRef = useRef<RecoverResponse>()
  const viewRef = useRef(view)
  viewRef.current = view
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
      setWalletInfo(undefined)
      setClassification(null)
      setPreviewCaveat(null)
      setGasEstimate(null)
      setNftTransferData(null)
      setManaTransferData(null)
      setIsTransactionModalOpen(false)
      setSimulationState({ status: 'idle' })
      setSimulationProfiles({})
      setSimulationChainId(undefined)
      setSimulationVerified([])
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
          const addresses = new Set<string>()
          for (const change of result.assetChanges) {
            if (change.from) addresses.add(change.from.toLowerCase())
            if (change.to) addresses.add(change.to.toLowerCase())
          }
          for (const approval of result.approvalChanges) {
            if (approval.spender) addresses.add(approval.spender.toLowerCase())
          }
          addresses.delete(signerAddress.toLowerCase())
          addresses.delete('0x0000000000000000000000000000000000000000')

          const entries = await Promise.all(
            [...addresses].map(async address => {
              try {
                const profile = await fetchProfile(address)
                const name = getProfileDisplayName(profile, address)
                return name ? ([address, name] as const) : null
              } catch {
                return null
              }
            })
          )
          if (isStale()) return
          const resolved = Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null))
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
        const collectVerifiedContracts = (result: SimulationResponseBody, chainId: number): string[] => {
          const reviewed = classificationRef.current
          const calledContract = reviewed && isDecentralandClassification(reviewed) ? reviewed.contract.address : null
          const verified = new Set<string>()
          const consider = (address: string | null) => {
            if (!address) return
            const normalized = address.toLowerCase()
            if (normalized === calledContract || getKnownDecentralandContract(normalized, chainId)) verified.add(normalized)
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
        // `rejectUnpreviewable` is for signatures that leave Auth as a bearer authorization (a
        // typed-data MetaTransaction). When the server rejects the call itself (400) there is no
        // preview to fall back to, so the request is rejected instead of degrading to an
        // acknowledgment: otherwise oversized or otherwise unpreviewable calldata would be a
        // deterministic way to skip the preview. Outages (5xx, timeouts) still degrade.
        const fetchSimulation = async (body: SimulationRequestBody, { rejectUnpreviewable = false } = {}) => {
          try {
            const result = await authServerClient.current.simulateTransaction(body)
            if (isStale()) return
            setSimulationState({ status: 'ready', result })
            setSimulationVerified(collectVerifiedContracts(result, body.chainId))
            void resolveSimulationProfiles(result)
            return result
          } catch (e) {
            if (isStale()) return
            // Nothing to reject once the user has already answered (e.g. denied while loading).
            if (rejectUnpreviewable && e instanceof SimulationUnavailableError && e.status === 400 && !hasCompletedRef.current) {
              const rejection = new MalformedSignatureRequestError(request.method, 'the MetaTransaction call cannot be previewed')
              hasCompletedRef.current = true
              setError(rejection.message)
              setView(View.WALLET_INTERACTION_ERROR)
              await reportRejectedRequest(RPC_INVALID_PARAMS, rejection.message)
              return
            }
            console.info('Transaction simulation unavailable:', e instanceof Error ? e.message : String(e))
            setSimulationState({ status: 'unavailable' })
          }
        }

        // Whether the preview of a call can be vouched for at all (see PreviewCaveat): a call that hands
        // tokens to a recipient with code runs that recipient's callback inside the transaction, and a
        // simulation cannot be relied on to show what such code does. Judged by Decentraland's RPC on the
        // execution chain; when it cannot answer, the recipient is treated as code, so the page never
        // vouches for a preview on a guess. Resolved before the simulation is fetched, while Allow is
        // still blocked on the loading preview.
        const detectPreviewCaveat = async (call: DecodedCall, chainId: number): Promise<PreviewCaveat | null> => {
          const recipient = getCallbackRecipient(call)
          if (!recipient) return null
          let withoutCode = false
          try {
            withoutCode = await isAddressWithoutCode(recipient, chainId)
          } catch {
            // Unknown is not "no code".
          }
          return withoutCode ? null : 'recipient_contract'
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
          const caveat = await detectPreviewCaveat(transaction.call, transaction.chainId)
          if (isStale()) return
          setPreviewCaveat(caveat)
          const simulationPromise = fetchSimulation(buildSendTransactionSimulationPayload(transaction, signerAddress))

          // The branded gift view vouches for the transfer being the whole effect, which the page cannot
          // do when the recipient's own code runs inside it: such a gift stays on the generic review and
          // its acknowledgment.
          if (transaction.branded !== 'gift_candidate' || caveat !== null) return
          const transferData = decodeNftTransferData(transaction.call)
          if (!transferData) return
          try {
            // A recognized selector is not a complete preview: keep the branded view only when the sole
            // visible effect is exactly the transfer it shows; anything else stays on the generic summary
            // and its acknowledgment gates. The user may also have answered from the generic review while
            // the simulation ran; their answer stands.
            const simulation = await simulationPromise
            if (isStale()) return
            if (!simulation || !isExactNftTransferSimulation(simulation, signerAddress, transaction.to, transferData)) return

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
            const caveat = await detectPreviewCaveat(classified.call, classified.chainId)
            if (isStale()) return
            setPreviewCaveat(caveat)
            void fetchSimulation(
              buildMetaTransactionSimulationPayload(classified.chainId, classified.contract.address, classified.calldata, signerAddress),
              { rejectUnpreviewable: true }
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
          hasCompletedRef.current = true
          setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
          setView(View.WALLET_INTERACTION_ERROR)
          await reportRejectedRequest(RPC_INVALID_PARAMS, e.message)
          return
        } else if (e instanceof MalformedSignatureRequestError || e instanceof MalformedTransactionRequestError) {
          // The params could preview one payload and sign or execute another, or the request is aimed at a
          // Decentraland contract but is not shaped the way the SDK builds one (see classifyRequest). Block
          // it; a retry recovers the same request.
          hasCompletedRef.current = true
          setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
          setView(View.WALLET_INTERACTION_ERROR)
          await reportRejectedRequest(RPC_INVALID_PARAMS, e.message)
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
          // contract Decentraland does not know, so the request is neither reviewed nor answered:
          // the error view offers a retry and the request stays available for it.
          setError(e.message)
          setView(View.LOADING_ERROR)
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
        if (address.toLowerCase() !== recoveredSignerRef.current) {
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
      isSettlingRef.current = false
    }

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

  const restartTransactionReview = useCallback(
    (reason: ReviewRestartReason) => {
      // Make the stale review non-actionable immediately, then let the load effect's existing reset
      // clear every derived preview/classification and recover the same request again. No outcome is
      // sent: a missing, changed, or temporarily unreadable chain says nothing about the user's
      // decision and the request must remain available for the fresh review. The restart is neither
      // silent nor invisible: it is reported so the frequency of a security-relevant invalidation is
      // visible in production, and the re-reviewed page says why it reloaded, so an Allow that seems
      // not to take is explained.
      trackEvent(TrackingEvents.TRANSACTION_REVIEW_RESTARTED, { requestId, reason })
      pendingReviewRestartRef.current = reason
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
    isSettlingRef.current = true
    setIsLoading(true)
    setIsTransactionModalOpen(false)
    const walletClient = walletClientRef.current
    // Answers the request as failed for the account that reviewed it, or not at all. After async wallet
    // work the wallet's active account is read again: if it is no longer the reviewing account, nothing
    // is sent, because the outcome endpoint does not check the sender and the reviewed request would be
    // consumed as a rejection from an account that never saw it. The caller then shows the account-change
    // view and leaves the request for the fresh review the load effect starts.
    const reportFailedOutcomeForReviewedSigner = async (error: OutcomeError): Promise<'sent' | 'other_account' | 'unsent'> => {
      if (!walletClient) return 'unsent'
      const [currentAddress] = await walletClient.getAddresses()
      if (currentAddress.toLowerCase() !== recoveredSignerRef.current) return 'other_account'
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
      if (signerAddress.toLowerCase() !== recoveredSignerRef.current) {
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
        if (reviewedChainId === undefined || currentChainId !== reviewedChainId) {
          // The address and calldata may refer to entirely different code on another chain, and
          // an unreadable chain cannot be compared safely. Discard the stale review and recover
          // the still-unconsumed request so it is previewed on a verified live chain.
          restartTransactionReview(
            reviewedChainId === undefined ? 'network_unrecorded' : currentChainId === undefined ? 'network_unreadable' : 'network_changed'
          )
          return
        }
        result = await walletClient.request({
          method: 'eth_sendTransaction',
          // Also bind the request to the reviewed chain. This is defense in depth for injected
          // wallets, which validate the standard JSON-RPC chainId and refuse a last-moment switch
          // between the check above and the send instead of broadcasting on the new chain (that
          // refusal is routed back into the review, see the catch). Embedded wallets ignore it —
          // thirdweb rebuilds the transaction from its own chain and Magic is unverified — so for
          // them the check above is the whole guard.
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
      }
      showInteractionCompleteView()
    } catch (e) {
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
        hasCompletedRef.current = true
        showInteractionCompleteView()
      } else if (e instanceof ReviewedSignerMismatchError) {
        // The wallet's active account changed between the check above and the relay's own account
        // read, so nothing was signed or submitted. Not the user's decision: no outcome, say what
        // happened, and let the load effect start over for the new account.
        setView(View.DIFFERENT_ACCOUNT)
      } else if (isChainMismatchRejection(e)) {
        // The wallet refused the send because its network no longer matches the reviewed chain: the
        // binding above fired. That is not the user's decision, so answer nothing and review again.
        restartTransactionReview('wallet_rejected_chain')
      } else if (isUserRejectedTransaction(e)) {
        console.info('User rejected wallet interaction in wallet — not reporting to Sentry')
        let delivery: 'sent' | 'other_account' | 'unsent' = 'unsent'
        try {
          delivery = await reportFailedOutcomeForReviewedSigner({ code: -32003, message: 'Transaction rejected' })
        } catch (failedOutcomeError) {
          console.error('Failed to send denied notification:', failedOutcomeError)
        }
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
        if (delivery === 'other_account') {
          setView(View.DIFFERENT_ACCOUNT)
          return
        }

        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.WALLET_INTERACTION_ERROR)
      }
    } finally {
      setIsLoading(false)
      isSettlingRef.current = false
    }
  }, [isUserUsingWeb2Wallet, nftTransferData, manaTransferData, requestId, identity, showInteractionCompleteView, restartTransactionReview])

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
  const hasPreviewWithoutVisibleEffects = simulationState.status === 'ready' && hasNoVisibleEffects(simulationState.result, account ?? '')
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
      previewCaveat !== null ||
      hasDangerousApprovalChange ||
      hasPreviewWithoutVisibleEffects ||
      simulationState.status === 'unavailable' ||
      isSignatureWithoutVerifiedEffects)

  // Derived, not synced: on the render where the route id or the account changes, every piece of
  // state still belongs to the previous review. Show none of it — no summary, no Allow — until this
  // instance has started loading the current id for the current account, which the load effect
  // records together with its reset.
  const renderedView = loadedRequestId === requestId && loadedAccount === account ? view : View.LOADING_REQUEST

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
      return <SigningError error={error} />
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
            userAddress={account ?? ''}
            profiles={simulationProfiles}
            verifiedContracts={simulationVerified}
            chainId={simulationChainId}
            requiresAcknowledgment={requiresApprovalAcknowledgment}
            previewCaveat={previewCaveat}
            gas={gas}
            isReverted={isSimulationReverted}
            reviewRestarted={reviewRestartReason !== null}
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
            userAddress={account ?? ''}
            profiles={simulationProfiles}
            verifiedContracts={simulationVerified}
            chainId={simulationChainId}
            requiresAcknowledgment={requiresApprovalAcknowledgment}
            previewCaveat={previewCaveat}
            isLoading={isLoading}
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
            payloadFingerprint={getPayloadFingerprint(classification)}
            isLoading={isLoading}
            reviewRestarted={reviewRestartReason !== null}
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
