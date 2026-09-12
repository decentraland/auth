import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
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
  InvalidRequestExpirationError,
  MalformedSignatureRequestError,
  MalformedTransactionRequestError,
  OutcomeError,
  RecoverResponse,
  RequestFulfilledError,
  ReviewedRequestInvalidatedError,
  ReviewedSignerMismatchError,
  UnsupportedMethodError,
  bindProviderToSigner,
  createAuthServerHttpClient,
  getKnownToken,
  getRequestExpirationTimestamp,
  isRecognizedDecentralandContract,
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
import { identifyUser, trackEvent } from '../../../shared/utils/analytics'
import { handleError } from '../../../shared/utils/errorHandler'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import {
  RequestClassification,
  classifyRequest,
  describeClassification,
  getPayloadFingerprint,
  isTransactionClassification
} from './classifyRequest'
import { GasEstimateState, MANATransferData, NFTTransferData, TransferType } from './types'
import {
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
  isDecentralandCollection
} from './utils'
import {
  ActionRequestView,
  ClientLoginError,
  ConfirmRequestDialog,
  ContinueInApp,
  DeniedWalletInteraction,
  DifferentAccountError,
  LoadingRequest,
  LookupUnavailableError,
  OutdatedClientError,
  RecoverError,
  SigningError,
  TimeoutError,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  WalletInteractionComplete
} from './Views'
import type { ActionRequestPayload, SigningErrorKind } from './Views'
import { ConfirmRequestGas } from './Views/ConfirmRequestDialog'
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
  // Wallet Interaction: the generic review of anything that is not a tip or a gift, and the two branded ones
  WALLET_INTERACTION,
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
const INTERACTION_VIEWS = new Set([View.WALLET_INTERACTION, View.WALLET_NFT_INTERACTION, View.WALLET_MANA_INTERACTION])

// Reported to the client when a request is rejected at recover time, before it reaches the wallet.
const RPC_METHOD_NOT_SUPPORTED = -32601
const RPC_INVALID_PARAMS = -32602

// Why a transaction review was discarded and started over (see restartReview).
type ReviewRestartReason = 'network_changed' | 'network_unreadable' | 'network_unrecorded' | 'wallet_rejected_chain' | 'lookup_unavailable'

type DecentralandTransaction = Extract<RequestClassification, { kind: 'dcl_transaction' }>

/**
 * Exactly what the wallet will be handed for a classified request, for the generic review to show whole:
 * the transaction fields as they will be dispatched, the typed data as the wallet will read it, or the
 * message bytes. Nothing is inferred from it: an unverified schema can carry unsigned decoy fields and take
 * exponential work to hash, so the original JSON is shown and no call or digest is computed for display.
 */
function getActionPayload(classification: RequestClassification): ActionRequestPayload {
  switch (classification.kind) {
    case 'dcl_transaction':
    case 'unknown_transaction':
      return {
        kind: 'transaction',
        to: classification.to,
        data: classification.data,
        value: classification.value,
        chainId: classification.chainId,
        // A relayed call reaches the wallet as a meta-transaction to sign, not as this transaction to send.
        relayed: classification.kind === 'dcl_transaction' && classification.relayed
      }
    case 'native_transfer':
      return { kind: 'transaction', to: classification.to, data: '0x', value: classification.value, chainId: classification.chainId }
    case 'dcl_meta_transaction':
    case 'unknown_meta_transaction':
    case 'unknown_typed_data':
      return { kind: 'typed_data', raw: classification.raw }
    case 'personal_sign':
      return { kind: 'message', hex: classification.hex, text: classification.text }
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
  // What the recovered request is (see classifyRequest). Null until classification resolves; nothing
  // is rendered for the request before then, so Allow cannot exist before its kind is known. The ref
  // is what the approve path reads, so it dispatches on exactly what was reviewed.
  const [classification, setClassification] = useState<RequestClassification | null>(null)
  const classificationRef = useRef<RequestClassification | null>(null)
  // The RPC method the wallet will be asked, as the request was recovered (canonical casing). Part of the
  // acknowledgment statement: the two typed-data methods share a classification and a payload, so without
  // it a re-review that recovered the same typed data under the other method would inherit the tick.
  const [reviewedMethod, setReviewedMethod] = useState<string>()
  // The wallet-side fee estimate of a transaction the user pays gas for. Null when no estimate applies.
  const [gasEstimate, setGasEstimate] = useState<GasEstimateState | null>(null)
  const [nftTransferData, setNftTransferData] = useState<NFTTransferData | null>(null)
  const [manaTransferData, setManaTransferData] = useState<MANATransferData | null>(null)
  // The confirmation dialog web2 users get on every Allow (see handleApproveWalletInteraction).
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  // Whether every contract a tip or a gift reaches is Decentraland's (see verifyCounterparties). The
  // branded screens stand in for the raw payload only once this is decided, and Allow on them stays
  // blocked until then.
  const [areCounterpartiesVerified, setAreCounterpartiesVerified] = useState(false)
  // Empty addresses a tip or a gift may invoke; the absence of code can change before execution.
  const [mutableCallbackAddresses, setMutableCallbackAddresses] = useState<string[]>([])
  // Chain a tip or a gift executes on, for the recipient's block-explorer link.
  const [reviewedChainId, setReviewedChainId] = useState<number>()
  const requestRef = useRef<RecoverResponse>()
  const requestExpirationRef = useRef<number>()
  const requestLoadStartedRef = useRef<number>()
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
  // The provider the load that produced the review on screen started with. Read during rendering, so a
  // review whose connection has been replaced stops being actionable on the render that replaces it —
  // before the load effect that redoes the review has run (see isReviewActionable).
  const [loadedProvider, setLoadedProvider] = useState<typeof provider>()
  // Whether the review on screen was made through the connection the page holds now. A wallet that hands
  // the app a new provider object — an embedded wallet rebuilding its SDK, a chain change reported through
  // the connection — starts a fresh review of the same request, but only when the load effect runs: React
  // has already rendered, committed and painted the previous review under the new provider by then, and
  // the wallet and public clients an answer would use are still the replaced provider's. So this is
  // decided here, during that render, and both answers read it before they touch anything (see
  // isReviewActionable, onDenyWalletInteraction). The ref carries the value to the handlers.
  const isReviewConnectionCurrent = loadedProvider === provider
  const isReviewConnectionCurrentRef = useRef(false)
  isReviewConnectionCurrentRef.current = isReviewConnectionCurrent
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
  // The review run that holds the settle lock (see reviewRunRef). A run that replaced it ignores a lock the
  // earlier run still holds: an Allow parked on a wallet the app has since discarded may never settle, and
  // the replacement review must not stay wedged behind it. The old action, for its part, releases only the
  // lock it took, so it cannot unlock an action the new run has in flight.
  const settlingRunRef = useRef(0)
  // Requests reserved by an Allow handed to the wallet or the relay SDK. The relay reservation includes
  // its asynchronous preparation; its provider revalidates the review immediately before signing. Once
  // the wallet has been asked, execution can complete whatever the page does next. Until the operation
  // settles, every review of that request stays busy. Other request ids remain independently actionable.
  //
  // The ref is what the handlers read, before their first await; the state is what the render reads, so a
  // dispatch that settles always releases the screen even when the review it belonged to is long gone.
  const dispatchingRequestsRef = useRef<ReadonlySet<string>>(new Set())
  const [dispatchingRequests, setDispatchingRequests] = useState<ReadonlySet<string>>(new Set())
  const setRequestDispatching = useCallback((id: string, dispatching: boolean) => {
    const next = new Set(dispatchingRequestsRef.current)
    if (dispatching) next.add(id)
    else next.delete(id)
    dispatchingRequestsRef.current = next
    setDispatchingRequests(next)
  }, [])
  // Which review the page is on: bumped by the load effect whenever the request id or the account changes.
  // Allow and Deny capture it when they start and, after every await, touch no view, loading or settle
  // state unless it is still current: a late wallet or server result belongs to the review that started
  // it, not to the one on screen (see onDenyWalletInteraction, onApproveWalletInteraction).
  const reviewGenerationRef = useRef(0)
  /**
   * Which load produced the review on screen. Invalidated on cleanup and advanced by every load, including one that runs again for
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
  // Every expiry path settles and reports through the same transition. An overdue timer or a
  // delayed wallet/relay continuation cannot report twice or replace an already completed outcome.
  const expireRequest = useCallback(() => {
    if (hasCompletedRef.current) return
    hasCompletedRef.current = true
    clearTimeout(timeoutRef.current)
    getAnalytics()?.track(TrackingEvents.REQUEST_EXPIRED, {
      browserTime: Date.now(),
      requestTime: requestExpirationRef.current,
      timeTheSiteStartedLoading: requestLoadStartedRef.current
    })
    setView(View.TIMEOUT)
  }, [])
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
    const controller = new AbortController()

    const checkProfile = async () => {
      const redirectTo = buildRequestPageUrl(requestId, targetConfigId, { isDeepLinkFlow, isBridgeOnly, authRequestId })
      const referrer = extractReferrerFromSearchParameters(searchParams)
      try {
        const profile = await ensureProfile(account, identityRef.current, { redirectTo, referrer, signal: controller.signal })

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
      controller.abort()
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
    // counterparty verdict and completion — must go; otherwise a click on Allow could execute the new
    // request under the previous request's review and acknowledgment. `loadedRequestId`
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
      setClassification(null)
      setReviewedMethod(undefined)
      setAreCounterpartiesVerified(false)
      setMutableCallbackAddresses([])
      setMutableCallbackAcknowledged(false)
      setGasEstimate(null)
      setNftTransferData(null)
      setManaTransferData(null)
      setIsTransactionModalOpen(false)
      setReviewedChainId(undefined)
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
      requestLoadStartedRef.current = Date.now()
      requestExpirationRef.current = undefined
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

        // Thirdweb's adapter only signs typed data through v4; v3 falls through to its public RPC.
        // Refuse it before asking for consent, without changing the signing method's semantics.
        if (providerType === ProviderType.THIRDWEB && request.method === 'eth_signTypedData_v3') {
          throw new UnsupportedMethodError(request.method)
        }

        // Keep the public response's string field compatible, while the timer and every dispatch
        // check share this one validated numeric deadline. Also fail closed for alternate clients.
        const expiration = getRequestExpirationTimestamp(request.expiration)
        requestExpirationRef.current = expiration
        requestRef.current = request
        recoveredRequestIdRef.current = requestId
        recoveredSignerRef.current = signerAddress.toLowerCase()

        const expirationDelay = expiration - Date.now()
        if (expirationDelay <= 0) {
          expireRequest()
          return
        }
        const scheduleExpiry = () => {
          if (isStale()) return
          const remaining = expiration - Date.now()
          if (remaining <= 0) {
            expireRequest()
          } else {
            // Browser timers use a signed 32-bit delay. Recheck long deadlines in chunks rather
            // than letting an overflowing delay expire a valid request immediately.
            timeoutRef.current = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647))
          }
        }
        scheduleExpiry()

        // Whether a tip or a gift may be shown as one. The branded screens name a recipient and an amount and
        // nothing else, so they may stand in for the raw payload only when nothing the call reaches could do
        // more than that: every address the call reaches (see getCounterpartyAddresses: a safe transfer's
        // recipient, a nested call) must be a Decentraland contract on the execution chain, one of the
        // stablecoins the marketplaces settle in (see getKnownToken) or a plain account without code, and
        // nothing the call carries may have gone unread. Anything else is code the requester chose, running
        // inside the transaction, and the request stays on the generic review, where the payload is shown
        // whole and the user takes responsibility for it. Cheapest answer first: the registry costs nothing,
        // one code read settles a plain wallet (the usual counterparty), and only an address with code on
        // the relay chain asks the factories. Judged by Decentraland's RPC; when it cannot answer, the
        // address counts as such code, so the page never vouches for a transfer on a guess. Resolves to
        // whether the branded screen may be shown; false also when the review went stale meanwhile.
        const verifyCounterparties = async (call: DecodedCall, chainId: number): Promise<boolean> => {
          try {
            const emptyAddresses = new Set<string>()
            const { addresses, opaque } = getCounterpartyAddresses(call, chainId)
            if (opaque) return false
            const collectionsLiveHere = chainId === Number(getMetaTransactionChainId())
            const isRecognizedOrPlain = async (address: string): Promise<boolean> => {
              try {
                if (isRecognizedDecentralandContract(address, chainId) || getKnownToken(address, chainId)) return true
                if (await isAddressWithoutCode(address, chainId)) {
                  // Code can be deployed after this lookup and before the reviewed call executes.
                  // Keep the check, but require consent to that limitation before approval.
                  // Nobody else can deploy at an existing EOA's address. If the reviewing signer has
                  // code already, however, it must pass the same contract check as every other callback.
                  if (address.toLowerCase() !== signerAddress.toLowerCase()) {
                    emptyAddresses.add(address.toLowerCase())
                  }
                  return true
                }
                return collectionsLiveHere && (await isDecentralandCollection(address))
              } catch {
                return false
              }
            }
            const verdicts = await Promise.all(addresses.map(isRecognizedOrPlain))
            if (isStale()) return false
            if (verdicts.some(verdict => !verdict)) return false
            setMutableCallbackAddresses([...emptyAddresses].sort())
            setAreCounterpartiesVerified(true)
            return true
          } catch (e) {
            console.error('The contracts the call reaches could not be checked', e)
            return false
          }
        }

        // The wallet-side fee estimate for a transaction the user pays gas for (a plain send on the
        // connected chain). Non-blocking; Allow stays disabled until it resolves, so the confirmation a web2
        // user gets always states the cost, or that it could not be estimated.
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

        // The review of a call to a Decentraland contract: the branded tip and gift screens when the call is
        // one of those and everything it reaches is Decentraland's, the generic review of the raw payload
        // otherwise. The branded screens are a convenience over the generic review, not a gate: when one of
        // their lookups fails (a counterparty, token metadata, recipient profile, place), the generic review
        // stands.
        const reviewDecentralandTransaction = async (transaction: DecentralandTransaction) => {
          setReviewedChainId(transaction.chainId)

          if (transaction.branded === 'tip') {
            const verified = await verifyCounterparties(transaction.call, transaction.chainId)
            if (isStale()) return
            if (verified) {
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
                      'https://peer.decentraland.org/content/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y',
                    // Null when no place was identified, and then the views show no location and the name
                    // stands for nothing (see fetchPlaceByCreatorAddress).
                    sceneLocation: placeInfo?.sceneLocation ?? null
                  })
                  setView(View.WALLET_MANA_INTERACTION)
                  return
                }
              } catch (e) {
                if (isStale()) return
                console.error('Error building the branded tip view, falling back to the generic review', e)
              }
            }
          }

          // The generic review is shown at once, so Deny is available and Allow is a tick away. A gift
          // candidate is upgraded to the branded view only once the contracts it reaches were checked and the
          // token's metadata is in.
          setView(View.WALLET_INTERACTION)
          if (!transaction.relayed) {
            void estimateTransactionFee(transaction)
          }

          if (transaction.branded !== 'gift_candidate') return
          const transferData = decodeNftTransferData(transaction.call)
          // Only the signer's own token is a gift: a transfer from any other account stays on the generic
          // review, whose payload says whose token it is.
          if (!transferData || transferData.fromAddress.toLowerCase() !== signerAddress.toLowerCase()) return
          try {
            // The user may have answered from the generic review while the check ran; their answer stands.
            const verified = await verifyCounterparties(transaction.call, transaction.chainId)
            if (isStale() || !verified) return

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
        // deployment its target is judged against, so it is read before classifying.
        let connectedChainId: number | undefined
        if (request.method === 'eth_sendTransaction') {
          const currentChainId = await publicClient.getChainId()
          if (isStale()) return
          connectedChainId = currentChainId
          reviewedWalletChainIdRef.current = currentChainId
        }

        // Decide once what this request is. Only a Decentraland tip or gift gets a screen of its own; everything
        // else is shown as exactly what it is, behind one acknowledgment.
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
        setReviewedMethod(request.method)
        trackEvent(TrackingEvents.REQUEST_CLASSIFIED, { requestId, ...describeClassification(classified) })

        switch (classified.kind) {
          case 'dcl_transaction':
            await reviewDecentralandTransaction(classified)
            break
          case 'native_transfer':
          case 'unknown_transaction':
            // A plain send on the connected chain: the user pays gas.
            setView(View.WALLET_INTERACTION)
            void estimateTransactionFee({
              to: classified.to,
              data: classified.kind === 'native_transfer' ? '0x' : classified.data,
              value: classified.value
            })
            break
          default:
            setView(View.WALLET_INTERACTION)
        }
      } catch (e) {
        if (isStale()) return

        if (e instanceof DifferentSenderError) {
          // Not reported: the outcome endpoint does not check the sender, so answering here would
          // consume a request addressed to another account.
          setView(View.DIFFERENT_ACCOUNT)
          return
        } else if (e instanceof ExpiredRequestError) {
          if (e.expiration) requestExpirationRef.current = getRequestExpirationTimestamp(e.expiration)
          expireRequest()
          return
        } else if (e instanceof InvalidRequestExpirationError) {
          hasCompletedRef.current = true
          setError(e.message)
          setView(View.LOADING_ERROR)
          await reportRejectedRequest(RPC_INVALID_PARAMS, e.message)
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
          // The params could describe one payload and sign or execute another, or the request is aimed at a
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
      // And every load records the provider it runs for, which is what the render compares against. Set
      // here rather than at the top of the effect: a run that returns before this point has not reviewed
      // anything through the new provider, and until one does, nothing may be approved.
      setLoadedProvider(provider)
      if (!isNewRequest) {
        // The load is running again for the same request and the same account — an embedded wallet handed
        // the app a new provider object, the profile became ready — and it recovers, reclassifies and
        // re-reviews from scratch. The reset above is keyed to the request and the account, so it does
        // not run for this, and everything the previous run derived would stay on screen and stay
        // actionable while the fresh one works: a confirmation dialog opened a moment ago would still
        // confirm, and Allow would still read a counterparty verdict belonging to the run before it. So
        // the review is put back to "being decided" for as long as that takes. Not a reset:
        // `hasCompletedRef` and the settle state are the request's, not this run's, and an answered or
        // expired request must stay answered.
        setIsTransactionModalOpen(false)
        setAreCounterpartiesVerified(false)
        setMutableCallbackAddresses([])
        setMutableCallbackAcknowledged(false)
        // An Allow the previous run left in flight keeps its lock to itself (see settlingRunRef), so the
        // review that replaces it starts unlocked and at rest, whatever became of the wallet the old provider
        // was asking. A request already handed to the wallet is shown busy by the render instead, for as long
        // as that lasts and for whichever review is on screen (see dispatchingRequestsRef).
        setIsLoading(false)
        // Everything else the previous run derived goes too, and the page says it is deciding again. Each
        // of these already blocked approval on its own — an unverified counterparty set, an acknowledgment
        // whose statement no longer matches — but only as a side effect of what it happens to gate.
        // Dropping them says it once: no part of the previous review is on screen or actionable while its
        // replacement is being worked out.
        setClassification(null)
        classificationRef.current = null
        setReviewedMethod(undefined)
        setGasEstimate(null)
        setNftTransferData(null)
        setManaTransferData(null)
        setView(View.LOADING_REQUEST)
      }
      loadRequest()
    }

    return () => {
      cancelled = true
      // An approval still preparing a relay must not start signing after this review is discarded,
      // including when the page unmounts. Already dispatched wallet results still deliver their outcome.
      reviewRunRef.current += 1
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
    reviewAttempt,
    expireRequest
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
    // Nor a review made through a connection the page has since replaced: the answer would go out through
    // the replaced provider's clients, and marking the request answered below would tell the load that is
    // about to redo the review that there is nothing left to do. Refused before either, so that load runs
    // and Deny can be given again on the review it produces. Not re-checked after the await: a Deny that
    // was in flight when the connection moved was decided on this request, by this account, through the
    // wallet that was current when it was pressed, and that load has already left the review alone on its
    // account — backing out then would leave nothing to redo it.
    if (!isReviewConnectionCurrentRef.current) return
    // One answer per request: not while Allow or an earlier Deny of this same review is in flight, and not
    // once the request has been answered or has expired. Checked and set before the first await (see
    // isSettlingRef, settlingRunRef).
    const run = reviewRunRef.current
    if (
      (isSettlingRef.current && settlingRunRef.current === run) ||
      dispatchingRequestsRef.current.has(requestId) ||
      hasCompletedRef.current
    )
      return
    isSettlingRef.current = true
    settlingRunRef.current = run
    // The review this answer belongs to. Once the page has moved on to another request or account, the
    // outcome already sent stands, but nothing here may touch the review now on screen.
    const generation = reviewGenerationRef.current
    const isStaleAction = () => reviewGenerationRef.current !== generation
    // The account that reviewed this request, fixed now: the ref moves on to the next review's account while
    // this answer is in flight, and an outcome must never be compared with or delivered under that one.
    const reviewedSigner = recoveredSignerRef.current
    // The decision is final the moment the user clicks: mark completion before the outcome
    // round-trip so nothing that resolves in the meantime (e.g. a late counterparty refusal)
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
      // Only the lock this action took: a replacement run may hold its own by now.
      if (!isStaleAction() && settlingRunRef.current === run) isSettlingRef.current = false
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
      // clear everything derived from the classification and recover the same request again. No outcome is
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
    // And the review it was clicked on. A load that runs again for the same request and account leaves the
    // generation alone by design, so this is what tells that review from the one that replaced it.
    const run = reviewRunRef.current
    if (
      (isSettlingRef.current && settlingRunRef.current === run) ||
      dispatchingRequestsRef.current.has(requestId) ||
      hasCompletedRef.current
    )
      return
    // Every gate the review is subject to, enforced here rather than trusted to whichever button was
    // pressed. The Allow buttons render the same value, so in the ordinary case this changes nothing; what
    // it stops is a press that reaches this handler while the gates do not hold — the confirmation dialog
    // web2 users get, whose own button knows only whether an approval is already running, still open when
    // a re-review began behind it (see isReviewActionable).
    if (!isReviewActionableRef.current) return
    isSettlingRef.current = true
    settlingRunRef.current = run
    // The review this action belongs to. Once the page has moved on to another request or account, the
    // wallet result and its outcome delivery still complete for the request that was reviewed, but nothing
    // here may touch the review now on screen or its settle state.
    const generation = reviewGenerationRef.current
    const isStaleAction = () => reviewGenerationRef.current !== generation
    // Whether the request may still be signed or sent, re-read after every await that precedes a dispatch.
    // Each of those awaits is a window: the expiration timer can fire in it (which settles the request and
    // shows the timeout screen without moving the generation, so `isStaleAction` alone does not see it),
    // a re-review can begin and even finish in it — which is why the run is checked as well as the gates,
    // since the gates are shared and a settled replacement makes them true again, while only the run says
    // whether they are true for the review this click was given to. The relay reserves dispatch before
    // its own asynchronous preparation, so its pre-sign callback checks validity without this shared
    // actionable gate (which the reservation closes). Once the wallet is asked, its outcome must still
    // be delivered whatever has happened to the review (see hasWalletResult).
    const expiration = requestExpirationRef.current
    const canStillDispatch = () => {
      if (isStaleAction() || reviewRunRef.current !== run || hasCompletedRef.current || !isReviewActionableRef.current) return false
      // Background tabs and clock corrections can leave the expiry timer overdue. Every dispatch
      // checks the deadline itself, after confirming that this action still owns the review on screen.
      if (expiration === undefined || Date.now() >= expiration) {
        expireRequest()
        return false
      }
      return true
    }
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
    // Reserves the request before handing it to the wallet or relay SDK, and holds the guard until the
    // action settles. A relay still checks validity after its preparation, at the actual signing boundary.
    let hasDispatched = false
    const markDispatched = () => {
      hasDispatched = true
      setRequestDispatching(requestId, true)
    }
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
        markDispatched()
        result = await sendMetaTransaction(
          bindProviderToSigner(connectedProvider, signerAddress, () => {
            // This request already holds the dispatch reservation, so the shared actionable gate is
            // false on its behalf. Check the review itself again after the SDK's account/nonce reads.
            if (isStaleAction() || reviewRunRef.current !== run || !isReviewConnectionCurrentRef.current || hasCompletedRef.current) {
              throw new ReviewedRequestInvalidatedError()
            }
            if (expiration === undefined || Date.now() >= expiration) {
              expireRequest()
              throw new ReviewedRequestInvalidatedError()
            }
          }),
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
          // the still-unconsumed request so it is reviewed on a verified live chain.
          restartReview(
            reviewedChainId === undefined ? 'network_unrecorded' : currentChainId === undefined ? 'network_unreadable' : 'network_changed'
          )
          return
        }
        markDispatched()
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
        markDispatched()
        result = await forwardSignatureRequest(walletClient, toWalletSignatureRequest(method, reviewed, signerAddress))
      }

      hasWalletResult = true

      // Execution is complete even while its outcome is being delivered. A slow delivery must not
      // leave the expiry timer armed or make an already executed interaction appear to have expired.
      if (!isStaleAction()) {
        hasCompletedRef.current = true
        clearTimeout(timeoutRef.current)
        showInteractionCompleteView()
      }

      trackClick(ClickEvents.APPROVE_WALLET_INTERACTION, {
        method: requestRef.current?.method
      })
      await authServerClient.current.sendSuccessfulOutcome(requestId, signerAddress, result)
      if (isStaleAction()) return

      // Notification delivery cannot delay or change a completed request. The helper bounds the fetch;
      // handle a rejection here as well so a background failure never becomes an unhandled promise.
      if (manaTransferData && result && identity) {
        void sendTipNotification(identity, result).catch(notificationError => {
          handleError(notificationError, 'Error sending the tip notification')
        })
      }
    } catch (e) {
      // No wallet action took place: expiry or a replacement review invalidated the relay during its
      // preparation. Leave that review's view and outcome alone.
      if (e instanceof ReviewedRequestInvalidatedError) return
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
      // Released for every review of this request, whatever became of the one that dispatched it: the
      // screen reads this, so a review that was shown busy on its behalf is freed here.
      if (hasDispatched) setRequestDispatching(requestId, false)
      // The review on screen owns its loading and settle state; a stale action, or one from a run that has
      // since been replaced, leaves both alone.
      if (!isStaleAction() && settlingRunRef.current === run) {
        isSettlingRef.current = false
        setIsLoading(false)
      }
    }
  }, [
    isUserUsingWeb2Wallet,
    nftTransferData,
    manaTransferData,
    requestId,
    identity,
    showInteractionCompleteView,
    restartReview,
    expireRequest
  ])

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

  // Derived, not synced: on the render where the route id or the account changes, every piece of
  // state still belongs to the previous review. Show none of it — no summary, no Allow — until this
  // instance has started loading the current id for the current account, which the load effect
  // records together with its reset.
  const renderedView = loadedRequestId === requestId && loadedAccount === account ? view : View.LOADING_REQUEST

  // A typed-data payload's fingerprint is its whole JSON, so it is computed once per classification.
  const payloadFingerprint = useMemo(() => (classification ? getPayloadFingerprint(classification) : ''), [classification])
  // The exact screen the user is asked to acknowledge, folded into one string: this request, the method the
  // wallet will be asked, this payload, and every notice shown next to them. A tick counts for that string
  // only, so anything that changes what is on screen or what is dispatched — another request, a re-review
  // that recovered the request under another method or found another callback — stops it counting and the
  // review asks again (see useAcknowledgment). One statement for every view rather than one composed inside
  // each: a view whose statement left out something it displayed would carry a tick across a change the
  // user never saw.
  const acknowledgmentStatement = useMemo(
    () => [requestId, reviewedMethod ?? '', classification?.kind ?? '', payloadFingerprint, mutableCallbackAddresses.join(',')].join('|'),
    [requestId, reviewedMethod, classification?.kind, payloadFingerprint, mutableCallbackAddresses]
  )
  const { acknowledged: isAcknowledged, setAcknowledged } = useAcknowledgment(acknowledgmentStatement)
  const { acknowledged: isMutableCallbackAcknowledged, setAcknowledged: setMutableCallbackAcknowledged } =
    useAcknowledgment(acknowledgmentStatement)

  // The wallet-side fee estimate a transaction the user pays gas for waits on, so the confirmation a web2
  // user gets always states the cost. A relayed call and a signature cost nothing and never wait for it.
  const isGasEstimatePending = gasEstimate === null || gasEstimate.status === 'loading'

  // The one place that decides whether the review on screen may be acted on: the acknowledgment was given
  // for this exact payload, the fee is known where the user pays it, and a branded screen has had the
  // contracts its call reaches checked. The Allow buttons render it and the approval handler enforces it, so
  // nothing can approve a review whose gates have not cleared — not a confirmation dialog opened a moment
  // before a re-review began, whose own button knows nothing about them, and not an Allow whose preparation
  // outlived the review it started from.
  //
  // `isLoading` is deliberately not part of it: that says an approval is already running, which is the
  // handler's own re-entry guard (isSettlingRef), not a property of the review.
  // This request is with the wallet and has not been answered. Whatever review of it is on screen, it is
  // busy rather than actionable, and stays that way until the wallet answers.
  const isRequestDispatching = dispatchingRequests.has(requestId)
  const isReviewActionable = (() => {
    if (classification === null) return false
    if (isRequestDispatching) return false
    // Unlike the request id and the account, a replaced connection gates the answers rather than the
    // rendering: the review is still what the user was last shown, and a completed or failed screen must
    // not blink back to loading because the wallet swapped a provider object.
    if (!isReviewConnectionCurrent) return false
    // A relayed call and a signature cost the user nothing; a plain send waits for its fee estimate.
    const isFeeKnownIfPaid =
      !isTransactionClassification(classification) ||
      (classification.kind === 'dcl_transaction' && classification.relayed) ||
      !isGasEstimatePending
    switch (renderedView) {
      case View.WALLET_INTERACTION:
        // Nothing is vouched for here: the payload is shown whole and the acknowledgment is always required.
        return isFeeKnownIfPaid && isAcknowledged
      // A branded screen stands in for the payload only once the contracts its call reaches were checked (see
      // reviewDecentralandTransaction), and its callback consent when one is asked.
      case View.WALLET_NFT_INTERACTION:
        return (
          nftTransferData !== null && areCounterpartiesVerified && (mutableCallbackAddresses.length === 0 || isMutableCallbackAcknowledged)
        )
      case View.WALLET_MANA_INTERACTION:
        return (
          manaTransferData !== null && areCounterpartiesVerified && (mutableCallbackAddresses.length === 0 || isMutableCallbackAcknowledged)
        )
      default:
        return false
    }
  })()
  isReviewActionableRef.current = isReviewActionable
  // The spinner the views and the confirmation dialog show: this action's own, or the one a dispatch for this
  // request left behind.
  const isBusy = isLoading || isRequestDispatching
  const approveBlocked = isBusy || !isReviewActionable

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
      isLoading={isBusy}
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
      return nftTransferData ? (
        <TransferCompletedView type={TransferType.GIFT} transferData={nftTransferData} />
      ) : (
        <WalletInteractionComplete />
      )
    case View.WALLET_MANA_INTERACTION_COMPLETE:
      return manaTransferData ? (
        <TransferCompletedView type={TransferType.TIP} transferData={manaTransferData} />
      ) : (
        <WalletInteractionComplete />
      )
    case View.WALLET_INTERACTION_DENIED:
      return <DeniedWalletInteraction />
    case View.WALLET_NFT_INTERACTION_DENIED:
      return nftTransferData ? (
        <TransferCanceledView type={TransferType.GIFT} transferData={nftTransferData} />
      ) : (
        <DeniedWalletInteraction />
      )
    case View.WALLET_MANA_INTERACTION_DENIED:
      return manaTransferData ? (
        <TransferCanceledView type={TransferType.TIP} transferData={manaTransferData} />
      ) : (
        <DeniedWalletInteraction />
      )
    case View.LOADING_REQUEST:
      return <LoadingRequest />

    case View.WALLET_NFT_INTERACTION:
      return nftTransferData ? (
        <>
          {confirmDialog}
          <TransferConfirmView
            type={TransferType.GIFT}
            transferData={nftTransferData}
            isLoading={isBusy}
            chainId={reviewedChainId}
            callbackAddresses={mutableCallbackAddresses}
            callbackAcknowledged={isMutableCallbackAcknowledged}
            approveBlocked={approveBlocked}
            onCallbackAcknowledgedChange={setMutableCallbackAcknowledged}
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
            isLoading={isBusy}
            chainId={reviewedChainId}
            callbackAddresses={mutableCallbackAddresses}
            callbackAcknowledged={isMutableCallbackAcknowledged}
            approveBlocked={approveBlocked}
            onCallbackAcknowledgedChange={setMutableCallbackAcknowledged}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      ) : null
    case View.WALLET_INTERACTION:
      if (!classification) return null
      return (
        <>
          {confirmDialog}
          <ActionRequestView
            key={requestId}
            requestId={requestId}
            payload={getActionPayload(classification)}
            method={reviewedMethod}
            acknowledged={isAcknowledged}
            approveBlocked={approveBlocked}
            isLoading={isBusy}
            reviewRestarted={reviewRestartReason !== null}
            onAcknowledgedChange={setAcknowledged}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      )
    default:
      return null
  }
}
