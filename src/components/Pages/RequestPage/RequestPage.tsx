import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { ContractName, getContract, sendMetaTransaction } from 'decentraland-transactions'
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
  DifferentSenderError,
  ExpiredRequestError,
  IdentityResponse,
  ImpersonatedSignInError,
  MalformedSignatureRequestError,
  RecoverResponse,
  RequestFulfilledError,
  SimulationRequestBody,
  SimulationResponseBody,
  SimulationUnavailableError,
  UnsupportedMethodError,
  buildMetaTransactionSimulationPayload,
  createAuthServerHttpClient
} from '../../../shared/auth'
import { isRetiredSignInMethod } from '../../../shared/auth/signMethodGuard'
import { isSocialProviderType, useCurrentConnectionData } from '../../../shared/connection'
import { isSessionMismatch } from '../../../shared/connection/sessionMismatch'
import { isErrorWithMessage, isRpcError, isUserRejectedTransaction } from '../../../shared/errors'
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
import { buildTransactionParams } from './transactionParams'
import { MANATransferData, NFTTransferData, SignaturePayload, SimulationState, TransferType } from './types'
import {
  buildSendTransactionSimulationPayload,
  checkMetaTransactionSupport,
  decodeManaTransferData,
  decodeMetaTransactionTypedData,
  decodeNftTransferData,
  extractSignaturePayload,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  getConnectedProvider,
  getExplorerDeeplink,
  getMetaTransactionChainId,
  getNetworkProvider,
  getSigninDeeplink,
  isApprovalGrantingTypedData,
  isKnownDecentralandContract,
  isSignatureMethod
} from './utils'
import {
  ClientLoginError,
  ContinueInApp,
  DeniedWalletInteraction,
  DifferentAccountError,
  LoadingRequest,
  OutdatedClientError,
  RecoverError,
  SignatureRequestView,
  SigningError,
  TimeoutError,
  TransactionConfirmDialog,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  WalletInteraction,
  WalletInteractionComplete
} from './Views'

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

// Reported to the client when a request is rejected at recover time, before it reaches the wallet.
const RPC_METHOD_NOT_SUPPORTED = -32601
const RPC_INVALID_PARAMS = -32602

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
  const [walletInfo, setWalletInfo] = useState<{
    balance: bigint
    chainId: number
  }>()
  const [transactionGasCost, setTransactionGasCost] = useState<bigint>()
  const [nftTransferData, setNftTransferData] = useState<NFTTransferData | null>(null)
  const [manaTransferData, setManaTransferData] = useState<MANATransferData | null>(null)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [simulationState, setSimulationState] = useState<SimulationState>({ status: 'idle' })
  // Resolved counterparty display names (lowercased address → name), filled in progressively.
  const [simulationProfiles, setSimulationProfiles] = useState<Record<string, string>>({})
  // Chain the pending transaction/meta-tx was simulated on, for block-explorer links.
  const [simulationChainId, setSimulationChainId] = useState<number>()
  // Lowercased addresses in the simulation that are recognized Decentraland contracts.
  const [simulationVerified, setSimulationVerified] = useState<string[]>([])
  // Whether the pending eth_sendTransaction will be relayed as a meta-transaction (gas covered
  // by Decentraland's gas tank), so the confirm dialog can hide the user-facing gas cost.
  const [isMetaTransaction, setIsMetaTransaction] = useState(false)
  const [signaturePayload, setSignaturePayload] = useState<SignaturePayload | null>(null)
  // Whether the pending typed-data signature is a Decentraland MetaTransaction. Unlike a relayed
  // eth_sendTransaction, the signature leaves Auth, so no contract is ever "trusted" enough to skip
  // the acknowledgment when its inner call could not be previewed (see requiresApprovalAcknowledgment).
  const [isSignatureMetaTx, setIsSignatureMetaTx] = useState(false)
  // Whether the typed-data signature grants an off-chain asset approval (EIP-2612 Permit, Permit2,
  // Seaport order). These aren't simulated, so they must always require an explicit acknowledgment.
  const [isHighRiskSignature, setIsHighRiskSignature] = useState(false)
  const requestRef = useRef<RecoverResponse>()
  const viewRef = useRef(view)
  viewRef.current = view
  const hasCompletedRef = useRef(false)
  // Guards against re-entrant approvals (e.g. a fast double-click on the confirm dialog),
  // which would otherwise fire two transactions before `isLoading` re-renders the buttons.
  const isApprovingRef = useRef(false)
  // Caches the meta-transaction support check from the prefetch so the approve path can reuse it
  // for the same contract instead of repeating the (potentially networked) lookup.
  const metaTxCheckRef = useRef<{ address: string; willUseMetaTransaction: boolean; contractName: ContractName | null } | null>(null)
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
  const [isProfileReady, setIsProfileReady] = useState(false)
  const [error, setError] = useState<string>()
  const [identityId, setIdentityId] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const requestId = params.requestId ?? ''
  const [targetConfig, targetConfigId] = useTargetConfig()
  const skipSetup = useSkipSetup()
  // Social / web2 wallets (Magic and Thirdweb) sign without their own confirmation UI, so the
  // auth site must show what is being approved (transaction simulation + signature preview and
  // the associated acknowledgment gates). This is always on for web2 users — it is the only
  // confirmation they get. External wallets keep their own confirmation UI unchanged, so the
  // informative UI is not shown for them.
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
  // Sets isProfileReady=true once the profile is confirmed complete (or skipped).
  useEffect(() => {
    // A deep-link handoff with a malformed id short-circuits to the error view (see the load
    // effect below); skip the profile work so it can't navigate to setup for a request we reject.
    if (isInvalidDeepLinkId) return
    if (isConnecting || !account || !provider || !providerType) return
    if (!initializedFlags) return

    // Reset profile readiness when the account changes so loadRequest
    // doesn't fire with stale profile state.
    setIsProfileReady(false)

    if (skipSetup) {
      setIsProfileReady(true)
      return
    }

    let cancelled = false

    const checkProfile = async () => {
      const redirectTo = buildRequestPageUrl(requestId, targetConfigId, { isDeepLinkFlow, isBridgeOnly, authRequestId })
      const referrer = extractReferrerFromSearchParameters(searchParams)
      try {
        const profile = await ensureProfile(account, identityRef.current, { redirectTo, referrer })

        if (!cancelled && profile) {
          setIsProfileReady(true)
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

    // Don't re-fetch if we're already in a terminal view (completed, denied, error, etc.)
    // This prevents the bug where after approving, dependency changes cause a re-fetch
    // of an already-consumed request
    if (TERMINAL_VIEWS.has(viewRef.current) || hasCompletedRef.current) {
      return
    }

    let cancelled = false

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
      publicClientRef.current = createPublicClient({ transport: custom(provider) })
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

        if (cancelled) return

        requestRef.current = request

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
            setView(View.TIMEOUT)
          }, expirationDelay)
        }

        // Resolves Decentraland profile names for the transaction's counterparties as a
        // progressive enhancement — the summary renders immediately with addresses and names
        // fill in when (and if) they resolve. Never blocks or fails the summary.
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
                const name = profile?.avatars?.[0]?.name
                return name ? ([address, name] as const) : null
              } catch {
                return null
              }
            })
          )
          if (cancelled) return
          const resolved = Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null))
          if (Object.keys(resolved).length > 0) {
            setSimulationProfiles(resolved)
          }
        }

        // Collects the addresses in the simulation that are recognized Decentraland contracts,
        // so the summary can show a "verified" badge next to them.
        const collectVerifiedContracts = (result: SimulationResponseBody): string[] => {
          const verified = new Set<string>()
          const consider = (address: string | null) => {
            if (address && isKnownDecentralandContract(address)) verified.add(address.toLowerCase())
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

        // Best-effort transaction simulation for web2 users. Fires without blocking the view
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
            if (cancelled) return
            setSimulationState({ status: 'ready', result })
            setSimulationVerified(collectVerifiedContracts(result))
            void resolveSimulationProfiles(result)
          } catch (e) {
            if (cancelled) return
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

        // Show different views depending on the request method.
        switch (request.method) {
          case 'eth_sendTransaction': {
            try {
              // Get wallet info first
              const userBalance = await publicClientRef.current.getBalance({ address: signerAddress })
              const currentChainId = await publicClientRef.current.getChainId()

              if (cancelled) return

              setWalletInfo({
                balance: userBalance,
                chainId: currentChainId
              })

              // Check if this is an NFT transfer or MANA transfer by analyzing the transaction data
              const txParams = request.params?.[0] as Record<string, unknown> | undefined
              const transactionData = txParams?.data as string | undefined
              const contractAddress = txParams?.to as string | undefined

              if (transactionData && contractAddress) {
                const manaData = decodeManaTransferData(transactionData, contractAddress)
                if (manaData) {
                  const [recipientProfile, placeInfo] = await Promise.all([
                    fetchProfile(manaData.toAddress),
                    fetchPlaceByCreatorAddress(manaData.toAddress)
                  ])

                  if (cancelled) return

                  setManaTransferData({
                    // Show the exact formatted amount (formatEther already trims trailing zeros).
                    // parseInt truncated fractional MANA, under-displaying what is actually signed.
                    manaAmount: `${manaData.manaAmount} MANA`,
                    toAddress: manaData.toAddress,
                    recipientProfile: recipientProfile || undefined,
                    sceneName: placeInfo?.sceneName || 'Unknown Place',
                    sceneImageUrl:
                      placeInfo?.sceneImageUrl ||
                      'https://peer.decentraland.org/content/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y'
                  })
                  // A MANA tip only decodes when it targets the canonical MANA contract, which is
                  // always relayed as a meta-transaction (gas covered by the gas tank). Mark it so
                  // the web2 confirm dialog says "gas covered" instead of showing a 0-ETH cost.
                  setIsMetaTransaction(true)
                  setView(View.WALLET_MANA_INTERACTION)
                  break
                }

                // Try to decode as NFT transfer using CollectionV2 contract
                // If it decodes successfully, it's an NFT transfer
                const chainId = getMetaTransactionChainId()
                const contract = getContract(ContractName.ERC721CollectionV2, chainId)
                const transferData = decodeNftTransferData(transactionData, contract.abi)

                if (transferData) {
                  // For web2 wallets (whose only confirmation is this site), only show the branded
                  // Decentraland "gift" view when the target is a verified DCL collection. Otherwise an
                  // arbitrary contract could impersonate a DCL wearable (spoofed name/image/rarity from
                  // its own tokenURI) to socially-engineer the transfer of the user's own NFT — so fall
                  // through to the generic simulation + acknowledgment path instead. Web3 wallets keep
                  // the instant branded view since the wallet itself shows the authoritative transaction.
                  // The verification result is cached in metaTxCheckRef so the generic fall-through and
                  // the approve path don't repeat the (networked) lookup for the same contract.
                  let isDclCollection = true
                  if (isUserUsingWeb2Wallet) {
                    const nftContractCheck = await checkMetaTransactionSupport(contractAddress)
                    if (cancelled) return
                    metaTxCheckRef.current = { address: contractAddress.toLowerCase(), ...nftContractCheck }
                    isDclCollection = nftContractCheck.willUseMetaTransaction
                  }

                  if (isDclCollection) {
                    const [metadata, recipientProfile] = await Promise.all([
                      fetchNftMetadata(contractAddress, contract.abi, transferData.tokenId),
                      fetchProfile(transferData.toAddress)
                    ])

                    if (cancelled) return

                    setNftTransferData({
                      imageUrl: metadata.imageUrl,
                      tokenId: transferData.tokenId,
                      toAddress: transferData.toAddress,
                      contractAddress,
                      name: metadata.name,
                      description: metadata.description,
                      rarity: metadata.rarity,
                      recipientProfile: recipientProfile || undefined
                    })
                    // The branded gift view is only shown for a verified DCL collection, which is
                    // relayed as a meta-transaction (gas covered). Mark it so the web2 confirm
                    // dialog says "gas covered" instead of showing a 0-ETH cost.
                    setIsMetaTransaction(true)
                    setView(View.WALLET_NFT_INTERACTION)
                    break
                  }
                }
              }

              // Generic transaction only — MANA tips and NFT gifts have their own views and
              // returned above, so they are left untouched. For web2 users, decide whether this
              // will be relayed as a meta-transaction (a Decentraland contract call, relayed on
              // Polygon where the gas tank pays) so the dialog can say "gas covered"; other
              // contracts/networks show the gas. Also prefetch the asset-change simulation of the
              // original transaction. Non-blocking.
              if (isUserUsingWeb2Wallet && contractAddress) {
                setSimulationState({ status: 'loading' })
                // Reuse the meta-transaction check if the NFT-gift gate already resolved it for this
                // same contract (it falls through to here for non-DCL contracts), so we don't repeat
                // the networked lookup.
                const cachedCheck = metaTxCheckRef.current
                const metaTxCheck =
                  cachedCheck && cachedCheck.address === contractAddress.toLowerCase()
                    ? Promise.resolve(cachedCheck)
                    : checkMetaTransactionSupport(contractAddress)
                metaTxCheck
                  .then(({ willUseMetaTransaction, contractName }) => {
                    // Cache the result so the approve path doesn't repeat the lookup for this tx.
                    metaTxCheckRef.current = { address: contractAddress.toLowerCase(), willUseMetaTransaction, contractName }
                    if (cancelled) return undefined
                    setIsMetaTransaction(willUseMetaTransaction)
                    if (txParams) {
                      const body = buildSendTransactionSimulationPayload(txParams, signerAddress, currentChainId, willUseMetaTransaction)
                      if (body) {
                        setSimulationChainId(body.chainId)
                        return fetchSimulation(body)
                      }
                      setSimulationState({ status: 'unavailable' })
                    }
                    return undefined
                  })
                  .catch(() => {
                    if (!cancelled) setSimulationState({ status: 'unavailable' })
                  })
              }

              const feeData = await publicClientRef.current.estimateFeesPerGas()
              const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? BigInt(0)
              const gasEstimateTxParams = request.params?.[0] as Record<string, unknown> | undefined
              const transactionGasEstimate = await publicClientRef.current.estimateGas({
                account: signerAddress,
                to: gasEstimateTxParams?.to as `0x${string}` | undefined,
                data: gasEstimateTxParams?.data as `0x${string}` | undefined,
                value: gasEstimateTxParams?.value ? BigInt(gasEstimateTxParams.value as string) : undefined
              })
              const totalGasCost = gasPrice * transactionGasEstimate
              setTransactionGasCost(totalGasCost)
            } catch (e) {
              console.error('Error estimating gas (may be normal for meta transactions)', e)
            }

            // Show regular wallet interaction view
            if (!cancelled) {
              setView(View.WALLET_INTERACTION)
            }
            break
          }
          default: {
            // For web2 users, plain signature requests get an informative preview of what they
            // are signing. Meta-transaction typed data additionally gets the asset-change summary
            // by simulating the inner call.
            if (isUserUsingWeb2Wallet && isSignatureMethod(request.method)) {
              const payload = extractSignaturePayload(request.method, request.params, signerAddress)
              setSignaturePayload(payload)
              if (payload?.kind === 'typedData') {
                // Off-chain approval permits/orders (EIP-2612, Permit2, Seaport) hand control of the
                // user's assets to a third party but are never simulated — always require an explicit
                // acknowledgment before signing them.
                if (isApprovalGrantingTypedData(payload.typedData)) {
                  setIsHighRiskSignature(true)
                }
                const metaTx = decodeMetaTransactionTypedData(payload.typedData, request.method)
                if (metaTx) {
                  setIsSignatureMetaTx(true)
                  setSimulationChainId(metaTx.chainId)
                  setSimulationState({ status: 'loading' })
                  // Preview the inner call the way the contract will make it — calling itself with
                  // the connected signer appended, not the `from` carried in the typed data — using
                  // the calldata field the signed struct declares, which the decoder proved to be the
                  // bytes the signature covers whatever else the message carries.
                  void fetchSimulation(
                    buildMetaTransactionSimulationPayload(metaTx.chainId, metaTx.verifyingContract, metaTx.calldata, signerAddress),
                    { rejectUnpreviewable: true }
                  )
                }
              }
              setView(View.WALLET_SIGNATURE_INTERACTION)
            } else {
              setView(View.WALLET_INTERACTION)
            }
          }
        }
      } catch (e) {
        if (cancelled) return

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
        } else if (e instanceof MalformedSignatureRequestError) {
          // The params could preview one payload and sign another. Block it; a retry recovers the same request.
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
    skipSetup
  ])

  useEffect(() => {
    // The timeout is only necessary on the wallet interaction views.
    // We can clear it out when the user is shown another view to prevent the timeout from triggering somewhere not intended.
    if (
      view !== View.WALLET_INTERACTION &&
      view !== View.WALLET_SIGNATURE_INTERACTION &&
      view !== View.WALLET_NFT_INTERACTION &&
      view !== View.WALLET_MANA_INTERACTION
    ) {
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
        await authServerClient.current.sendFailedOutcome(requestId, address, {
          code: -32003,
          message: 'Transaction rejected'
        })
      }
    } catch (error) {
      console.error('Failed to send denied notification:', error)
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

  const onApproveWalletInteraction = useCallback(async () => {
    // Prevent duplicate submissions — the confirm dialog buttons aren't disabled synchronously,
    // so a double-click could otherwise re-enter before the first call flips isLoading.
    if (isApprovingRef.current) return
    isApprovingRef.current = true
    setIsLoading(true)
    setIsTransactionModalOpen(false)
    const walletClient = walletClientRef.current
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
      const method = requestRef.current.method

      let result: string | null = null

      if (method !== 'eth_sendTransaction') {
        // Non-transaction methods (e.g. personal_sign, eth_signTypedData_v4) carry no `to`
        // address and are never relayed as meta-transactions — forward them straight to the
        // wallet. The `as` casts satisfy viem's typed request signature; the real method and
        // params are passed through unchanged at runtime.
        result = await walletClient.request({
          method: method as 'eth_sendTransaction',
          params: requestRef.current?.params as [Record<string, unknown>]
        })
      } else {
        const [transactionParams] = buildTransactionParams(requestRef.current?.params)
        const toAddress = transactionParams.to as string
        const chainId = getMetaTransactionChainId()

        // Check if this contract will use meta transactions, reusing the prefetch result for the
        // same contract when available to avoid repeating the lookup.
        const cachedCheck = metaTxCheckRef.current
        const { willUseMetaTransaction, contractName } =
          cachedCheck && cachedCheck.address === toAddress.toLowerCase() ? cachedCheck : await checkMetaTransactionSupport(toAddress)
        if (willUseMetaTransaction && contractName) {
          const connectedProvider = await getConnectedProvider()
          if (!connectedProvider) {
            throw new Error('Provider not connected')
          }

          const networkProvider = await getNetworkProvider(chainId)
          // getContract returns the registry entry BY REFERENCE, so mutating .address would
          // permanently rewrite the shared decentraland-transactions registry for the rest of the
          // session (poisoning later getContractName/isKnownDecentralandContract lookups). Clone it.
          const contract = { ...getContract(contractName, chainId), address: toAddress }

          result = await sendMetaTransaction(connectedProvider, networkProvider, transactionParams.data as string, contract, {
            serverURL: `${config.get('META_TRANSACTION_SERVER_URL')}/v1`
          })
        } else {
          result = await walletClient.request({
            method: 'eth_sendTransaction',
            params: [{ ...transactionParams, from: signerAddress }]
          })
        }
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
      } else if (isUserRejectedTransaction(e)) {
        console.info('User rejected wallet interaction in wallet — not reporting to Sentry')
        try {
          if (walletClientRef.current) {
            const [addr] = await walletClientRef.current.getAddresses()
            await authServerClient.current.sendFailedOutcome(requestId, addr, {
              code: -32003,
              message: 'Transaction rejected'
            })
          }
        } catch (failedOutcomeError) {
          console.error('Failed to send denied notification:', failedOutcomeError)
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
        try {
          if (walletClientRef.current) {
            const [addr] = await walletClientRef.current.getAddresses()
            if (isRpcError(e)) {
              await authServerClient.current.sendFailedOutcome(requestId, addr, e.error)
            } else {
              await authServerClient.current.sendFailedOutcome(requestId, addr, {
                code: 999,
                message: isErrorWithMessage(e) ? e.message : 'Unknown error'
              })
            }
          }
        } catch (failedOutcomeError) {
          console.error('Failed to send failed outcome:', failedOutcomeError)
        }

        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.WALLET_INTERACTION_ERROR)
      }
    } finally {
      setIsLoading(false)
      isApprovingRef.current = false
    }
  }, [isUserUsingWeb2Wallet, nftTransferData, manaTransferData, requestId, identity, showInteractionCompleteView])

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

  const isSimulationReverted = simulationState.status === 'ready' && simulationState.result.status === 'reverted'
  // The generic transaction view shows the asset summary whenever a simulation is in flight or
  // resolved. In that case approval is a single step (gas shown inline, no confirm modal); without
  // a summary it keeps the classic two-step confirm dialog for the gas check.
  const hasSimulationSummary = simulationState.status !== 'idle'
  // The simulation resolved and shows a high-risk permission: an unlimited ERC-20 allowance or a
  // full-collection ApprovalForAll.
  const hasDangerousApprovalChange =
    simulationState.status === 'ready' &&
    simulationState.result.approvalChanges.some(
      approval =>
        (approval.kind === 'approvalForAll' && approval.approved !== false) ||
        (approval.kind === 'approval' && !approval.tokenId && approval.isUnlimited)
    )
  // A typed-data MetaTransaction whose inner call could not be previewed: the simulation was
  // unavailable, or the call reverts today. Unlike an eth_sendTransaction relayed through the gas
  // tank — which Auth signs and submits in one step, so the signature is consumed the moment it is
  // made — a signed MetaTransaction is handed back to the requester as a bearer authorization: it
  // has no expiry and anyone holding it can submit it until the nonce is used. A call that reverts
  // now can therefore be relayed once the state changes, so "would fail" is not a safe preview.
  // Being a verified Decentraland contract does not change that, which is why the trusted
  // exemption below applies to the relay path only.
  const isSignatureWithoutVerifiedEffects = isSignatureMetaTx && (simulationState.status === 'unavailable' || isSimulationReverted)
  // Require an explicit acknowledgment before approving when: (a) the simulation shows a high-risk
  // permission; (b) the simulation could NOT be produced for a transaction we can't otherwise vouch
  // for — only a relayed meta-transaction to a known DCL contract is exempt (prevents the fail-open
  // where an unpreviewable payload degrades to a single-click approve); (c) a signed MetaTransaction
  // has no verified effects; or (d) the request is an off-chain approval signature (permit/order),
  // which grants asset control but is never simulated.
  const requiresApprovalAcknowledgment =
    hasDangerousApprovalChange ||
    (simulationState.status === 'unavailable' && !isMetaTransaction) ||
    isSignatureWithoutVerifiedEffects ||
    isHighRiskSignature

  switch (view) {
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
          <TransactionConfirmDialog
            open={isTransactionModalOpen}
            transactionCost={transactionGasCost ?? BigInt(0)}
            balance={walletInfo?.balance ?? BigInt(0)}
            gasCovered={isMetaTransaction}
            isReverted={isSimulationReverted}
            isLoading={isLoading}
            onCancel={onDenyWalletInteraction}
            onConfirm={onApproveWalletInteraction}
          />
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
          <TransactionConfirmDialog
            open={isTransactionModalOpen}
            transactionCost={transactionGasCost ?? BigInt(0)}
            balance={walletInfo?.balance ?? BigInt(0)}
            gasCovered={isMetaTransaction}
            isReverted={isSimulationReverted}
            isLoading={isLoading}
            onCancel={onDenyWalletInteraction}
            onConfirm={onApproveWalletInteraction}
          />
          <TransferConfirmView
            type={TransferType.TIP}
            transferData={manaTransferData}
            isLoading={isLoading}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      ) : null
    case View.WALLET_INTERACTION:
      return (
        <>
          {/* With a simulation summary the gas line is shown inline and approval is a single step,
              so the confirm dialog is only needed for the classic (no-summary) gas check. */}
          {hasSimulationSummary ? null : (
            <TransactionConfirmDialog
              open={isTransactionModalOpen}
              transactionCost={transactionGasCost ?? BigInt(0)}
              balance={walletInfo?.balance ?? BigInt(0)}
              gasCovered={isMetaTransaction}
              isReverted={isSimulationReverted}
              isLoading={isLoading}
              onCancel={onDenyWalletInteraction}
              onConfirm={onApproveWalletInteraction}
            />
          )}
          <WalletInteraction
            requestId={requestId}
            isWeb2Wallet={isUserUsingWeb2Wallet}
            explorerText={targetConfig.explorerText}
            isLoading={isLoading}
            simulation={simulationState}
            userAddress={account ?? ''}
            profiles={simulationProfiles}
            verifiedContracts={simulationVerified}
            chainId={simulationChainId}
            requiresAcknowledgment={requiresApprovalAcknowledgment}
            gasCovered={isMetaTransaction}
            transactionCost={transactionGasCost ?? BigInt(0)}
            balance={walletInfo?.balance ?? BigInt(0)}
            isReverted={isSimulationReverted}
            onDeny={onDenyWalletInteraction}
            onApprove={hasSimulationSummary ? onApproveWalletInteraction : handleApproveWalletInteraction}
          />
        </>
      )
    case View.WALLET_SIGNATURE_INTERACTION:
      return (
        <SignatureRequestView
          requestId={requestId}
          method={requestRef.current?.method ?? ''}
          payload={signaturePayload}
          simulation={simulationState}
          userAddress={account ?? ''}
          profiles={simulationProfiles}
          verifiedContracts={simulationVerified}
          chainId={simulationChainId}
          requiresAcknowledgment={requiresApprovalAcknowledgment}
          isMetaTransaction={isSignatureMetaTx}
          isLoading={isLoading}
          onDeny={onDenyWalletInteraction}
          onApprove={onApproveWalletInteraction}
        />
      )
    default:
      return null
  }
}
