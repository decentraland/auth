import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createPublicClient, createWalletClient, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { ContractName, getContract, sendMetaTransaction } from 'decentraland-transactions'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { isSessionMismatch } from '../../../hooks/useSessionMismatch'
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
  IpValidationError,
  RecoverResponse,
  RequestFulfilledError,
  SimulationRequestBody,
  SimulationResponseBody,
  TimedOutError,
  createAuthServerHttpClient
} from '../../../shared/auth'
import { isSocialProviderType, useCurrentConnectionData } from '../../../shared/connection'
import { isErrorWithMessage, isRpcError, isUserRejectedTransaction } from '../../../shared/errors'
import {
  CLIENT_LOGIN_REQUEST_ID,
  buildRequestPageUrl,
  extractReferrerFromSearchParameters,
  isBridgeOnlyEnabled
} from '../../../shared/locations'
import { sendTipNotification } from '../../../shared/notifications'
import { isProfileComplete } from '../../../shared/profile'
import { identifyUser } from '../../../shared/utils/analytics'
import { handleError } from '../../../shared/utils/errorHandler'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
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
  isKnownDecentralandContract,
  isSignatureMethod
} from './utils'
import {
  ClientLoginError,
  ContinueInApp,
  DeniedSignIn,
  DeniedWalletInteraction,
  DifferentAccountError,
  IpValidationError as IpValidationErrorView,
  LoadingRequest,
  RecoverError,
  SignInComplete,
  SignInCompletePage,
  SignatureRequestView,
  SigningError,
  TimeoutError,
  TransactionConfirmDialog,
  TransferCanceledView,
  TransferCompletedView,
  TransferConfirmView,
  VerifySignIn,
  WalletInteraction,
  WalletInteractionComplete
} from './Views'

enum View {
  TIMEOUT,
  DIFFERENT_ACCOUNT,
  IP_VALIDATION_ERROR,
  // Loading
  LOADING_REQUEST,
  LOADING_ERROR,
  // Verify Sign In
  VERIFY_SIGN_IN,
  VERIFY_SIGN_IN_DENIED,
  VERIFY_SIGN_IN_ERROR,
  VERIFY_SIGN_IN_COMPLETE,
  // Deep Link Flow
  DEEP_LINK_CONTINUE_IN_APP,
  // Client-login pseudo request (identity post failed)
  CLIENT_LOGIN_ERROR,
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
  View.VERIFY_SIGN_IN_COMPLETE,
  View.VERIFY_SIGN_IN_DENIED,
  View.VERIFY_SIGN_IN_ERROR,
  View.DEEP_LINK_CONTINUE_IN_APP,
  View.CLIENT_LOGIN_ERROR,
  View.WALLET_INTERACTION_COMPLETE,
  View.WALLET_NFT_INTERACTION_COMPLETE,
  View.WALLET_MANA_INTERACTION_COMPLETE,
  View.WALLET_INTERACTION_DENIED,
  View.WALLET_NFT_INTERACTION_DENIED,
  View.WALLET_MANA_INTERACTION_DENIED,
  View.WALLET_INTERACTION_ERROR,
  View.TIMEOUT,
  View.LOADING_ERROR,
  View.DIFFERENT_ACCOUNT,
  View.IP_VALIDATION_ERROR
])

export const RequestPage = () => {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigateWithSearchParams()
  const { isLoading: isConnecting, account, provider, providerType, identity } = useCurrentConnectionData()
  const { flags, initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const { trackClick } = useAnalytics()
  const { ensureProfile } = useEnsureProfile()
  const publicClientRef = useRef<ReturnType<typeof createPublicClient>>()
  const walletClientRef = useRef<ReturnType<typeof createWalletClient>>()
  const [view, setView] = useState(View.LOADING_REQUEST)
  const [isLoading, setIsLoading] = useState(false)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [skipDeepLinkRedirect, setSkipDeepLinkRedirect] = useState(false)
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
  const [isSignatureMetaTx, setIsSignatureMetaTx] = useState(false)
  const requestRef = useRef<RecoverResponse>()
  const viewRef = useRef(view)
  viewRef.current = view
  const hasCompletedRef = useRef(false)
  // Guards against re-entrant approvals (e.g. a fast double-click on the confirm dialog),
  // which would otherwise fire two transactions before `isLoading` re-renders the buttons.
  const isApprovingRef = useRef(false)
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
  const signTimeoutRef = useRef<NodeJS.Timeout>()
  const requestId = params.requestId ?? ''
  const [targetConfig, targetConfigId] = useTargetConfig()
  const skipSetup = useSkipSetup()
  // Social / web2 wallets (Magic and Thirdweb) sign without their own confirmation UI, so the
  // auth site must show what is being approved. `provider.isMagic` alone misses Thirdweb.
  const isUserUsingWeb2Wallet = isSocialProviderType(providerType)
  // The informative simulation/signature UI is only shown to web2 users and gated behind a
  // feature flag for rollout. External wallets keep their own confirmation UI unchanged.
  const canShowSimulation = isUserUsingWeb2Wallet && !!flags[FeatureFlagsKeys.TRANSACTION_SIMULATION]
  const authServerClient = useRef(createAuthServerHttpClient())
  const isDeepLinkFlow = searchParams.get('flow') === 'deeplink'
  // The `client-login` pseudo request id has no backing auth-server request: skip the
  // whole recover/verify flow and hand the signed identity to the client via the deep
  // link, the same way the standalone mobile flow does.
  const isClientLoginFlow = requestId === CLIENT_LOGIN_REQUEST_ID
  // The bridge-only flag rides inside redirectTo so it survives logins/callbacks and can be
  // appended to the client deep link once the flow completes.
  const isBridgeOnly = isBridgeOnlyEnabled(searchParams)
  // Goes to the login page where the user will have to connect a wallet.
  // Preserve loginMethod from current URL if present for auto-login functionality
  const loginMethodParam = searchParams.get('loginMethod')

  const toLoginPage = useCallback(() => {
    const redirectToUrl = buildRequestPageUrl(requestId, targetConfigId, { isDeepLinkFlow, isBridgeOnly })
    const loginMethodQuery = loginMethodParam ? `&loginMethod=${encodeURIComponent(loginMethodParam)}` : ''
    const finalUrl = `/login?redirectTo=${encodeURIComponent(redirectToUrl)}${loginMethodQuery}`
    navigate(finalUrl)
  }, [requestId, targetConfigId, isDeepLinkFlow, isBridgeOnly, loginMethodParam, navigate])

  // Effect 1: Ensure profile consistency before allowing request loading.
  // Navigates to setup if the profile is incomplete or missing.
  // Sets isProfileReady=true once the profile is confirmed complete (or skipped).
  useEffect(() => {
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
      const redirectTo = buildRequestPageUrl(requestId, targetConfigId, { isDeepLinkFlow, isBridgeOnly })
      const referrer = extractReferrerFromSearchParameters(searchParams)
      const profile = await ensureProfile(account, identityRef.current, { redirectTo, referrer })

      if (!cancelled && profile) {
        setIsProfileReady(true)
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
    isBridgeOnly,
    searchParams,
    skipSetup
  ])

  // Effect 2: Load the request once the user is connected and the profile is ready.
  useEffect(() => {
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
    // deep link, which ContinueInApp fires immediately for this flow.
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
        if (!clientLoginPromiseRef.current) {
          clientLoginPromiseRef.current = authServerClient.current.postIdentity(currentIdentity)
        }
        const identityResponse = await clientLoginPromiseRef.current
        if (cancelled) return
        setIdentityId(identityResponse.identityId)
        setView(View.DEEP_LINK_CONTINUE_IN_APP)
      } catch (e) {
        // Clear the shared promise so Try Again (a page reload) can post again.
        clientLoginPromiseRef.current = null
        if (cancelled) return
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.CLIENT_LOGIN_ERROR)
      }
    }

    const loadRequest = async () => {
      const timeTheSiteStartedLoading = Date.now()
      publicClientRef.current = createPublicClient({ transport: custom(provider) })
      walletClientRef.current = createWalletClient({ chain: mainnet, transport: custom(provider) })

      try {
        const [signerAddress] = await walletClientRef.current.getAddresses()
        identifyUser(signerAddress)
        // Recover the request from the auth server.
        const request = await authServerClient.current.recover(requestId, signerAddress, isDeepLinkFlow)

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
        const fetchSimulation = async (body: SimulationRequestBody) => {
          try {
            const result = await authServerClient.current.simulateTransaction(body)
            if (cancelled) return
            setSimulationState({ status: 'ready', result })
            setSimulationVerified(collectVerifiedContracts(result))
            void resolveSimulationProfiles(result)
          } catch (e) {
            if (cancelled) return
            console.info('Transaction simulation unavailable:', e instanceof Error ? e.message : String(e))
            setSimulationState({ status: 'unavailable' })
          }
        }

        // Show different views depending on the request method.
        switch (request.method) {
          case 'dcl_personal_sign': {
            // For new users coming from Explorer (skipSetup=true), auto-sign without
            // showing the verification code screen. This matches the old behavior where
            // SetupPage signed the request automatically after profile deployment.
            // Returning users (with profile) still see the verification screen.
            if (skipSetup && !isDeepLinkFlow) {
              const userProfile = await fetchProfile(signerAddress)
              if (cancelled) return

              if (!userProfile || !isProfileComplete(userProfile)) {
                // New user: auto-sign and go straight to success.
                // Do NOT call notifyRequestNeedsValidation — the Explorer should
                // not show the verification code screen for new users.
                const autoSignMessage = request.params?.[0]
                if (typeof autoSignMessage !== 'string') break
                try {
                  const signature = await walletClientRef.current.signMessage({
                    account: signerAddress,
                    message: autoSignMessage
                  })
                  if (cancelled) return
                  await authServerClient.current.sendSuccessfulOutcome(requestId, signerAddress, signature)
                  hasCompletedRef.current = true
                  setView(View.VERIFY_SIGN_IN_COMPLETE)
                  break
                } catch (e) {
                  if (cancelled) return
                  console.info('Auto-sign failed for new user:', e instanceof Error ? e.message : String(e))
                  if (isUserRejectedTransaction(e)) {
                    hasCompletedRef.current = true
                    setView(View.VERIFY_SIGN_IN_DENIED)
                    break
                  }
                  setError(e instanceof Error ? e.message : 'Auto-sign failed')
                  setView(View.VERIFY_SIGN_IN_ERROR)
                  break
                }
              }
            }

            // Notify the auth server that the request needs validation.
            // This tells the Explorer to show the verification code screen.
            // Only reached for returning users (new users auto-signed above).
            if (flags[FeatureFlagsKeys.LOGIN_ON_SETUP]) {
              await authServerClient.current.notifyRequestNeedsValidation(requestId)
              if (cancelled) return
            }

            setView(View.VERIFY_SIGN_IN)
            break
          }
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

              // For web2 users, determine whether this transaction will be relayed as a
              // meta-transaction (gas covered by the gas tank) so the confirm dialog can hide
              // the user-gas lines, and — when the flag is on — prefetch the asset-change
              // simulation so it shows instantly. Non-blocking; the meta-tx decision is made
              // once here and reused for the simulation chain. Applies to all three tx sub-views.
              if (isUserUsingWeb2Wallet && contractAddress) {
                if (canShowSimulation) {
                  setSimulationState({ status: 'loading' })
                }
                checkMetaTransactionSupport(contractAddress)
                  .then(({ willUseMetaTransaction }) => {
                    if (cancelled) return undefined
                    setIsMetaTransaction(willUseMetaTransaction)
                    if (canShowSimulation && txParams) {
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
                    if (!cancelled && canShowSimulation) setSimulationState({ status: 'unavailable' })
                  })
              }

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
                  setView(View.WALLET_MANA_INTERACTION)
                  break
                }

                // Try to decode as NFT transfer using CollectionV2 contract
                // If it decodes successfully, it's an NFT transfer
                const chainId = getMetaTransactionChainId()
                const contract = getContract(ContractName.ERC721CollectionV2, chainId)
                const transferData = decodeNftTransferData(transactionData, contract.abi)

                if (transferData) {
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
                  setView(View.WALLET_NFT_INTERACTION)
                  break
                }
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
            // For web2 users (behind the flag), plain signature requests get an informative
            // preview of what they are signing. Meta-transaction typed data additionally gets
            // the asset-change summary by simulating the inner call.
            if (canShowSimulation && isSignatureMethod(request.method)) {
              const payload = extractSignaturePayload(request.method, request.params)
              setSignaturePayload(payload)
              if (payload?.kind === 'typedData') {
                const metaTx = decodeMetaTransactionTypedData(payload.typedData)
                if (metaTx) {
                  setIsSignatureMetaTx(true)
                  setSimulationChainId(metaTx.chainId)
                  setSimulationState({ status: 'loading' })
                  void fetchSimulation({
                    chainId: metaTx.chainId,
                    from: metaTx.from,
                    to: metaTx.verifyingContract,
                    data: metaTx.functionSignature,
                    value: '0'
                  })
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
          setView(View.DIFFERENT_ACCOUNT)
          return
        } else if (e instanceof ExpiredRequestError) {
          setView(View.TIMEOUT)
          return
        } else if (e instanceof IpValidationError) {
          setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
          setView(View.IP_VALIDATION_ERROR)
          return
        } else if (e instanceof RequestFulfilledError) {
          // Request was already consumed successfully — not an error, stop re-fetching
          hasCompletedRef.current = true
          setView(View.VERIFY_SIGN_IN_COMPLETE)
          return
        } else if (e instanceof ImpersonatedSignInError) {
          // A non-dcl_personal_sign request tried to sign a sign-in payload. Block it
          // outright instead of offering a retry that would re-trigger the same attack.
          hasCompletedRef.current = true
          setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
          setView(View.VERIFY_SIGN_IN_ERROR)
          return
        }

        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.LOADING_ERROR)
      }
    }

    if (isClientLoginFlow) {
      completeClientLoginFlow()
    } else {
      loadRequest()
    }

    return () => {
      cancelled = true
      clearTimeout(timeoutRef.current)
      clearTimeout(signTimeoutRef.current)
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
    isClientLoginFlow,
    skipSetup
  ])

  useEffect(() => {
    // The timeout is only necessary on the verify sign in and wallet interaction views.
    // We can clear it out when the user is shown another view to prevent the timeout from triggering somewhere not intended.
    if (
      view !== View.VERIFY_SIGN_IN &&
      view !== View.WALLET_INTERACTION &&
      view !== View.WALLET_SIGNATURE_INTERACTION &&
      view !== View.WALLET_NFT_INTERACTION &&
      view !== View.WALLET_MANA_INTERACTION
    ) {
      clearTimeout(timeoutRef.current)
    }
  }, [view])

  const onDenyVerifySignIn = useCallback(async () => {
    setIsLoading(true)
    trackClick(ClickEvents.DENY_SIGN_IN)
    try {
      if (walletClientRef.current) {
        const [address] = await walletClientRef.current.getAddresses()
        await authServerClient.current.sendFailedOutcome(requestId, address, {
          code: -32003,
          message: 'Transaction rejected'
        })
      }
    } finally {
      hasCompletedRef.current = true
      setIsLoading(false)
      setView(View.VERIFY_SIGN_IN_DENIED)
    }
  }, [])

  const onApproveSignInVerification = useCallback(async () => {
    trackClick(ClickEvents.APPROVE_SING_IN)
    setIsLoading(true)
    setHasTimedOut(false)
    const walletClient = walletClientRef.current
    let hasTimeouted = false

    if (!walletClient) {
      setIsLoading(false)
      throw new Error('Provider not created')
    }

    const [address] = await walletClient.getAddresses()

    signTimeoutRef.current = setTimeout(() => {
      hasTimeouted = true
      setHasTimedOut(true)
      setIsLoading(false)
    }, 30000)

    try {
      const signMessage = requestRef.current?.params?.[0]
      if (typeof signMessage !== 'string') throw new Error('Invalid sign message in request params')
      const signature = await walletClient.signMessage({ account: address, message: signMessage })

      if (hasTimeouted) {
        throw new TimedOutError()
      }
      // Check if this is deep link flow
      if (isDeepLinkFlow && identity) {
        const httpClient = createAuthServerHttpClient()
        const identityResponse = await httpClient.postIdentity(identity)

        setIdentityId(identityResponse.identityId)
        setView(View.DEEP_LINK_CONTINUE_IN_APP)
      } else {
        // Traditional flow - send outcome and complete
        await authServerClient.current.sendSuccessfulOutcome(requestId, address, signature)
        hasCompletedRef.current = true
        setView(View.VERIFY_SIGN_IN_COMPLETE)
        // For mobile deep-link flow, auto-redirect. For Explorer (skipSetup),
        // the SignInCompletePage shows a Continue button that triggers the deeplink.
        // Route through getExplorerDeeplink so this bare redirect carries the same
        // query params (dclenv, bridge-only) as the other deep-link generation sites.
        if (targetConfig.deepLink) {
          window.location.href = getExplorerDeeplink(targetConfig.deepLink, isBridgeOnly)
        }
      }
    } catch (e) {
      if (e instanceof TimedOutError) {
        return
      }

      if (isUserRejectedTransaction(e)) {
        console.info('User rejected sign-in verification in wallet — not reporting to Sentry')
        try {
          await authServerClient.current.sendFailedOutcome(requestId, address, {
            code: -32003,
            message: 'Transaction rejected'
          })
        } catch (failedOutcomeError) {
          console.error('Failed to send denied notification:', failedOutcomeError)
        }
        hasCompletedRef.current = true
        setView(View.VERIFY_SIGN_IN_DENIED)
      } else if (e instanceof IpValidationError) {
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.IP_VALIDATION_ERROR)
      } else {
        const errorMessage = handleError(e, 'Error approving sign in verification', {
          sentryTags: { isWeb2Wallet: isUserUsingWeb2Wallet }
        })
        setError(errorMessage)
        setView(View.VERIFY_SIGN_IN_ERROR)
      }
    } finally {
      if (signTimeoutRef.current) {
        clearTimeout(signTimeoutRef.current)
      }
      if (!hasTimeouted) {
        setIsLoading(false)
      }
    }
  }, [setIsLoading, isUserUsingWeb2Wallet, isLoading, identity, isBridgeOnly])

  const onDenyWalletInteraction = useCallback(async () => {
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

    hasCompletedRef.current = true
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
        const chainId = getMetaTransactionChainId()
        const txParams = requestRef.current?.params?.[0] as Record<string, unknown> | undefined
        const toAddress = txParams?.to as string | undefined

        if (!toAddress) {
          throw new Error(`Contract address not found in transaction parameters. Received params: ${JSON.stringify(txParams ?? null)}`)
        }

        // Check if this contract will use meta transactions
        const { willUseMetaTransaction, contractName } = await checkMetaTransactionSupport(toAddress)
        if (willUseMetaTransaction && contractName) {
          const connectedProvider = await getConnectedProvider()
          if (!connectedProvider) {
            throw new Error('Provider not connected')
          }

          const networkProvider = await getNetworkProvider(chainId)
          const contract = getContract(contractName, chainId)
          contract.address = toAddress

          result = await sendMetaTransaction(
            connectedProvider,
            networkProvider,
            (requestRef.current?.params?.[0] as Record<string, unknown>).data as string,
            contract,
            {
              serverURL: `${config.get('META_TRANSACTION_SERVER_URL')}/v1`
            }
          )
        } else {
          result = await walletClient.request({
            method: 'eth_sendTransaction',
            params: requestRef.current?.params as [Record<string, unknown>]
          })
        }
      }

      trackClick(ClickEvents.APPROVE_WALLET_INTERACTION, {
        method: requestRef.current?.method
      })
      await authServerClient.current.sendSuccessfulOutcome(requestId, signerAddress, result)
      hasCompletedRef.current = true

      if (nftTransferData) {
        setView(View.WALLET_NFT_INTERACTION_COMPLETE)
      } else if (manaTransferData) {
        if (result && identity) {
          await sendTipNotification(identity, result)
        }
        setView(View.WALLET_MANA_INTERACTION_COMPLETE)
      } else {
        setView(View.WALLET_INTERACTION_COMPLETE)
      }
    } catch (e) {
      if (isUserRejectedTransaction(e)) {
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
      } else if (e instanceof IpValidationError) {
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.IP_VALIDATION_ERROR)
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
  }, [isUserUsingWeb2Wallet, nftTransferData, manaTransferData, requestId, identity])

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
      trackClick(ClickEvents.IDENTITY_DEEP_LINK_OPENED)
    }

    // Client-login flow: the client was opened via the deep link and there is nothing to
    // navigate to — stay on the ContinueInApp view, which doubles as the retry fallback.
    if (isClientLoginFlow) return

    // The deep link already fired in ContinueInApp — skip the auto-redirect in SignInCompletePage
    setSkipDeepLinkRedirect(true)
    // Show completion view
    setView(View.VERIFY_SIGN_IN_COMPLETE)
  }, [identityId, trackClick, isClientLoginFlow])

  const onRetryClientLogin = useCallback(() => {
    // A fresh mount re-runs completeClientLoginFlow: the view resets to LOADING_REQUEST and
    // the in-flight promise ref clears, re-posting the identity with the still-cached login.
    window.location.reload()
  }, [])

  const isSimulationReverted = simulationState.status === 'ready' && simulationState.result.status === 'reverted'

  switch (view) {
    case View.TIMEOUT:
      return <TimeoutError requestId={requestId} />
    case View.DIFFERENT_ACCOUNT:
      return <DifferentAccountError requestId={requestId} />
    case View.IP_VALIDATION_ERROR:
      return <IpValidationErrorView requestId={requestId} reason={error || 'Unknown error'} />
    case View.LOADING_ERROR:
      return (
        <RecoverError
          onTryAgain={() => {
            window.location.href = getExplorerDeeplink(targetConfig.deepLink, isBridgeOnly)
          }}
        />
      )
    case View.VERIFY_SIGN_IN_ERROR:
    case View.WALLET_INTERACTION_ERROR:
      return <SigningError error={error} />
    case View.CLIENT_LOGIN_ERROR:
      return <ClientLoginError error={error} onTryAgain={onRetryClientLogin} />
    case View.VERIFY_SIGN_IN_COMPLETE:
      // From Explorer (skipSetup enabled): show full-page success with Continue button
      // From web (has redirectTo): show minimal success view
      return skipSetup ? (
        <SignInCompletePage skipRedirect={skipDeepLinkRedirect} deepLink={targetConfig.deepLink} bridgeOnly={isBridgeOnly} />
      ) : (
        <SignInComplete />
      )
    case View.DEEP_LINK_CONTINUE_IN_APP:
      return (
        <ContinueInApp
          onContinue={onContinueInApp}
          requestId={requestId}
          deepLinkUrl={getSigninDeeplink(targetConfig.deepLink, identityId ?? '', isBridgeOnly)}
          immediate={isClientLoginFlow}
        />
      )
    case View.VERIFY_SIGN_IN_DENIED:
      return <DeniedSignIn requestId={requestId} />
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
    case View.VERIFY_SIGN_IN:
      return (
        <VerifySignIn
          requestId={requestId}
          code={requestRef.current?.code}
          isLoading={isLoading}
          hasTimedOut={hasTimedOut}
          explorerText={targetConfig.explorerText}
          isDeepLinkFlow={isDeepLinkFlow}
          onDeny={onDenyVerifySignIn}
          onApprove={onApproveSignInVerification}
        />
      )

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
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
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
