import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { ethers, BrowserProvider, formatEther } from 'ethers'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { ChainId } from '@dcl/schemas'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Web2TransactionModal } from 'decentraland-ui/dist/components/Web2TransactionModal'
import { getContract, sendMetaTransaction, ContractName } from 'decentraland-transactions'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { fetchProfile, fetchProfileWithConsistencyCheck, redeployExistingProfile } from '../../../modules/profile'
import {
  createAuthServerHttpClient,
  RecoverResponse,
  ExpiredRequestError,
  DifferentSenderError,
  IpValidationError,
  TimedOutError
} from '../../../shared/auth'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isErrorWithMessage, isRpcError } from '../../../shared/errors'
import { extractReferrerFromSearchParameters, locations } from '../../../shared/locations'
import { isProfileComplete } from '../../../shared/profile'
import { handleError } from '../../../shared/utils/errorHandler'
import { checkWebGpuSupport } from '../../../shared/utils/webgpu'
import { FeatureFlagsContext, FeatureFlagsKeys, OnboardingFlowVariant } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import { Container } from './Container'
import { NFTTransferData, MANATransferData } from './types'
import {
  getNetworkProvider,
  getConnectedProvider,
  checkMetaTransactionSupport,
  getMetaTransactionChainId,
  decodeNftTransferData,
  decodeManaTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress
} from './utils'
import {
  ContinueInApp,
  DeniedSignIn,
  DeniedWalletInteraction,
  DifferentAccountError,
  IpValidationError as IpValidationErrorView,
  NFTTransferView,
  NFTTransferCompleteView,
  NFTTransferCanceledView,
  MANATransferView,
  MANATransferCompleteView,
  MANATransferCanceledView,
  RecoverError,
  SignInComplete,
  SigningError,
  TimeoutError,
  WalletInteractionComplete
} from './Views'
import viewStyles from './Views/Views.module.css'
import styles from './RequestPage.module.css'

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
  // Wallet Interaction
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

export const RequestPage = () => {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigateWithSearchParams()
  const { isLoading: isConnecting, account, provider, providerType, identity } = useCurrentConnectionData()
  const { flags, variants, initialized: initializedFlags } = useContext(FeatureFlagsContext)
  const { trackClick } = useAnalytics()
  const browserProvider = useRef<BrowserProvider>()
  const [view, setView] = useState(View.LOADING_REQUEST)
  const [isLoading, setIsLoading] = useState(false)
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [walletInfo, setWalletInfo] = useState<{
    balance: bigint
    chainId: number
  }>()
  const [transactionGasCost, setTransactionGasCost] = useState<bigint>()
  const [nftTransferData, setNftTransferData] = useState<NFTTransferData | null>(null)
  const [manaTransferData, setManaTransferData] = useState<MANATransferData | null>(null)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const requestRef = useRef<RecoverResponse>()
  const [error, setError] = useState<string>()
  const [identityId, setIdentityId] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const signTimeoutRef = useRef<NodeJS.Timeout>()
  const requestId = params.requestId ?? ''
  const [targetConfig, targetConfigId] = useTargetConfig()
  const isUserUsingWeb2Wallet = !!provider?.isMagic
  const authServerClient = useRef(createAuthServerHttpClient())
  const isDeepLinkFlow = searchParams.get('flow') === 'deeplink'
  const flowParam = isDeepLinkFlow ? '&flow=deeplink' : ''

  // Goes to the login page where the user will have to connect a wallet.
  const toLoginPage = useCallback(() => {
    navigate(locations.login(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}${flowParam}`))
  }, [requestId, targetConfigId, isDeepLinkFlow])

  const toSetupPage = useCallback(async () => {
    const referrer = extractReferrerFromSearchParameters(searchParams)
    // Check A/B testing new onboarding flow
    const isFlowV2OnboardingFlowEnabled = variants[FeatureFlagsKeys.ONBOARDING_FLOW]?.name === OnboardingFlowVariant.V2

    const hasWebGPU = await checkWebGpuSupport()
    const isAvatarSetupFlowAllowed = isFlowV2OnboardingFlowEnabled && hasWebGPU
    if (isAvatarSetupFlowAllowed) {
      navigate(locations.avatarSetup(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}${flowParam}`, referrer))
    } else {
      navigate(locations.setup(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}${flowParam}`, referrer))
    }
  }, [requestId, targetConfigId, isDeepLinkFlow, variants[FeatureFlagsKeys.ONBOARDING_FLOW], searchParams])

  useEffect(() => {
    // Wait for the user to be connected.
    if (isConnecting) return

    // Check if the user is connected.
    if (!account || !provider || !providerType) {
      toLoginPage()
      return
    }

    // Wait for the features to be initialized.
    if (!initializedFlags) return

    const loadRequest = async () => {
      const timeTheSiteStartedLoading = Date.now()
      browserProvider.current = new ethers.BrowserProvider(provider)

      const consistencyResult = await fetchProfileWithConsistencyCheck(account)
      console.log('Loading request - Consistency result', consistencyResult)
      if (!consistencyResult.isConsistent && consistencyResult.profile && identity) {
        try {
          await redeployExistingProfile(consistencyResult.profile, account, identity)
        } catch (error) {
          console.warn('Profile redeployment failed, falling back to login page:', error)
          toLoginPage()
        }
      }

      const profile = await fetchProfile(account)

      // `alternative` has its own set up
      if ((!targetConfig.skipSetup && !profile) || (profile && !isProfileComplete(profile))) {
        // Goes to the setup page if the connected account does not have a profile yet.
        console.log("There's no profile or the profile is not complete but the user is logged in, going to setup page")
        await toSetupPage()
        return
      }

      try {
        const signer = await browserProvider.current.getSigner()
        const signerAddress = await signer.getAddress()
        getAnalytics()?.identify({ ethAddress: signerAddress })
        // Recover the request from the auth server.
        const request = await authServerClient.current.recover(requestId, signerAddress, isDeepLinkFlow)
        requestRef.current = request

        if (flags[FeatureFlagsKeys.LOGIN_ON_SETUP]) {
          // Notify the auth server that the request needs validation.
          // This will make the explorer show the verification code to the user.
          await authServerClient.current.notifyRequestNeedsValidation(requestId)
        }

        // Initialize the timeout to display the timeout view when the request expires.
        timeoutRef.current = setTimeout(() => {
          getAnalytics()?.track(TrackingEvents.REQUEST_EXPIRED, {
            browserTime: Date.now(),
            requestTime: new Date(request.expiration).getTime(),
            timeTheSiteStartedLoading
          })
          setView(View.TIMEOUT)
        }, new Date(request.expiration).getTime() - Date.now())

        // Show different views depending on the request method.
        switch (request.method) {
          case 'dcl_personal_sign':
            setView(View.VERIFY_SIGN_IN)
            break
          case 'eth_sendTransaction': {
            try {
              // Get wallet info first
              const signer = await browserProvider.current.getSigner()
              const userBalance = await browserProvider.current.getBalance(signer.address)
              const currentChainId = await browserProvider.current.getNetwork().then(network => Number(network.chainId))
              setWalletInfo({
                balance: userBalance,
                chainId: currentChainId
              })

              // Check if this is an NFT transfer or MANA transfer by analyzing the transaction data
              const transactionData = request.params?.[0]?.data as string | undefined
              const contractAddress = request.params?.[0]?.to as string | undefined
              if (transactionData && contractAddress) {
                const manaData = decodeManaTransferData(transactionData)
                if (manaData) {
                  const [recipientProfile, placeInfo] = await Promise.all([
                    fetchProfile(manaData.toAddress),
                    fetchPlaceByCreatorAddress(manaData.toAddress)
                  ])

                  setManaTransferData({
                    manaAmount: `${parseFloat(manaData.manaAmount).toFixed(2)} MANA`,
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
                    fetchNftMetadata(contractAddress, contract.abi, transferData.tokenId, browserProvider.current),
                    fetchProfile(transferData.toAddress)
                  ])
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

              const gasPrice = (await browserProvider.current.getFeeData()).gasPrice ?? BigInt(0)
              const transactionGasCost = await signer.estimateGas(request.params?.[0])
              const totalGasCost = gasPrice * transactionGasCost
              setTransactionGasCost(totalGasCost)
            } catch (e) {
              console.error('Error estimating gas (may be normal for meta transactions)', e)
            }

            // Show regular wallet interaction view
            setView(View.WALLET_INTERACTION)
            break
          }
          default:
            setView(View.WALLET_INTERACTION)
        }
      } catch (e) {
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
        }

        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.LOADING_ERROR)
      }
    }

    loadRequest()

    return () => {
      clearTimeout(timeoutRef.current)
      clearTimeout(signTimeoutRef.current)
    }
  }, [toLoginPage, toSetupPage, account, provider, providerType, isConnecting, initializedFlags, identity])

  useEffect(() => {
    // The timeout is only necessary on the verify sign in and wallet interaction views.
    // We can clear it out when the user is shown another view to prevent the timeout from triggering somewhere not intended.
    if (
      view !== View.VERIFY_SIGN_IN &&
      view !== View.WALLET_INTERACTION &&
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
      const signer = await browserProvider.current?.getSigner()
      if (signer) {
        await authServerClient.current.sendFailedOutcome(requestId, await signer.getAddress(), {
          code: -32003,
          message: 'Transaction rejected'
        })
      }
    } finally {
      setIsLoading(false)
      setView(View.VERIFY_SIGN_IN_DENIED)
    }
  }, [])

  const onApproveSignInVerification = useCallback(async () => {
    trackClick(ClickEvents.APPROVE_SING_IN)
    setIsLoading(true)
    setHasTimedOut(false)
    const provider = browserProvider.current
    let hasTimeouted = false

    if (!provider) {
      setIsLoading(false)
      throw new Error('Provider not created')
    }

    console.log("Approve sign in verification - Getting the provider's signer")
    const signer = await provider.getSigner()

    signTimeoutRef.current = setTimeout(() => {
      hasTimeouted = true
      setHasTimedOut(true)
      setIsLoading(false)
    }, 30000)

    try {
      console.log("Approve sign in verification - Got the provider's signer. Signing the message")
      const signature = await signer.signMessage(requestRef.current?.params?.[0])

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
        console.log('Traditional flow - Sending outcome to server...')
        await authServerClient.current.sendSuccessfulOutcome(requestId, await signer.getAddress(), signature)
        console.log('Traditional flow - Outcome sent')
        setView(View.VERIFY_SIGN_IN_COMPLETE)
        if (targetConfig.deepLink) {
          window.location.href = targetConfig.deepLink
        }
      }
    } catch (e) {
      if (e instanceof TimedOutError) {
        return
      }

      if (e instanceof IpValidationError) {
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
  }, [setIsLoading, isUserUsingWeb2Wallet, isLoading, identity])

  const onDenyWalletInteraction = useCallback(async () => {
    setIsLoading(true)
    setIsTransactionModalOpen(false)
    trackClick(ClickEvents.DENY_WALLET_INTERACTION)

    try {
      const signer = await browserProvider.current?.getSigner()
      if (signer) {
        await authServerClient.current.sendFailedOutcome(requestId, await signer.getAddress(), {
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
    setIsLoading(true)
    setIsTransactionModalOpen(false)
    const provider = browserProvider.current
    try {
      if (!provider) {
        throw new Error('Provider not created')
      }

      if (!requestRef.current?.method) {
        throw new Error('Method not found')
      }

      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()
      const chainId = getMetaTransactionChainId()
      const toAddress = requestRef.current?.params?.[0]?.to

      if (!toAddress) {
        throw new Error('Contract address not found in transaction parameters')
      }

      let result: string | null = null

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

        result = await sendMetaTransaction(connectedProvider, networkProvider, requestRef.current?.params?.[0].data as string, contract, {
          serverURL: `${config.get('META_TRANSACTION_SERVER_URL')}/v1`
        })
      } else {
        result = await provider.send(requestRef.current?.method, requestRef.current?.params ?? [])
      }

      trackClick(ClickEvents.APPROVE_WALLET_INTERACTION, {
        method: requestRef.current?.method
      })
      await authServerClient.current.sendSuccessfulOutcome(requestId, signerAddress, result)

      if (nftTransferData) {
        console.log('Setting view to WALLET_NFT_INTERACTION_COMPLETE')
        setView(View.WALLET_NFT_INTERACTION_COMPLETE)
      } else if (manaTransferData) {
        console.log('Setting view to WALLET_MANA_INTERACTION_COMPLETE')
        setView(View.WALLET_MANA_INTERACTION_COMPLETE)
      } else {
        console.log('Setting view to WALLET_INTERACTION_COMPLETE')
        setView(View.WALLET_INTERACTION_COMPLETE)
      }
    } catch (e) {
      if (e instanceof IpValidationError) {
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.IP_VALIDATION_ERROR)
      } else {
        handleError(e, 'Wallet interaction error', {
          sentryTags: { isWeb2Wallet: isUserUsingWeb2Wallet }
        })

        // Try to send failed outcome, but don't let it prevent showing the error view
        try {
          const signer = await browserProvider.current?.getSigner()
          if (signer && isRpcError(e)) {
            await authServerClient.current.sendFailedOutcome(requestId, await signer.getAddress(), e.error)
          } else if (signer && !isRpcError(e)) {
            await authServerClient.current.sendFailedOutcome(requestId, await signer.getAddress(), {
              code: 999,
              message: isErrorWithMessage(e) ? e.message : 'Unknown error'
            })
          }
        } catch (failedOutcomeError) {
          // Log the error but don't prevent the error view from showing
          console.error('Failed to send failed outcome:', failedOutcomeError)
        }

        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.WALLET_INTERACTION_ERROR)
      }
    } finally {
      setIsLoading(false)
    }
  }, [isUserUsingWeb2Wallet, nftTransferData, manaTransferData, requestId])

  const handleApproveWalletInteraction = useCallback(async () => {
    if (isUserUsingWeb2Wallet) {
      setIsTransactionModalOpen(true)
    } else {
      await onApproveWalletInteraction()
    }
  }, [isUserUsingWeb2Wallet, onApproveWalletInteraction])

  const onContinueInApp = useCallback(() => {
    if (!identityId) return

    trackClick(ClickEvents.IDENTITY_DEEP_LINK_OPENED)

    // Show completion view
    setView(View.VERIFY_SIGN_IN_COMPLETE)
  }, [identityId, trackClick])

  switch (view) {
    case View.TIMEOUT:
      return <TimeoutError requestId={requestId} />
    case View.DIFFERENT_ACCOUNT:
      return <DifferentAccountError requestId={requestId} />
    case View.IP_VALIDATION_ERROR:
      return <IpValidationErrorView requestId={requestId} reason={error || 'Unknown error'} />
    case View.LOADING_ERROR:
      return <RecoverError error={error} />
    case View.VERIFY_SIGN_IN_ERROR:
    case View.WALLET_INTERACTION_ERROR:
      return <SigningError error={error} />
    case View.VERIFY_SIGN_IN_COMPLETE:
      return <SignInComplete />
    case View.DEEP_LINK_CONTINUE_IN_APP:
      return <ContinueInApp onContinue={onContinueInApp} requestId={requestId} deepLinkUrl={`decentraland://open?signin=${identityId}`} />
    case View.VERIFY_SIGN_IN_DENIED:
      return <DeniedSignIn requestId={requestId} />
    case View.WALLET_INTERACTION_COMPLETE:
      return <WalletInteractionComplete />
    case View.WALLET_NFT_INTERACTION_COMPLETE:
      return nftTransferData ? <NFTTransferCompleteView nftData={nftTransferData} /> : null
    case View.WALLET_MANA_INTERACTION_COMPLETE:
      return manaTransferData ? <MANATransferCompleteView manaData={manaTransferData} /> : null
    case View.WALLET_INTERACTION_DENIED:
      return <DeniedWalletInteraction />
    case View.WALLET_NFT_INTERACTION_DENIED:
      return nftTransferData ? <NFTTransferCanceledView nftData={nftTransferData} /> : null
    case View.WALLET_MANA_INTERACTION_DENIED:
      return manaTransferData ? <MANATransferCanceledView manaData={manaTransferData} /> : null
    case View.LOADING_REQUEST:
      return (
        <Container>
          <Loader active size="huge" />
        </Container>
      )
    case View.VERIFY_SIGN_IN: {
      return (
        <Container canChangeAccount requestId={requestId}>
          <div className={viewStyles.logo}></div>
          <div className={viewStyles.title}>Verify Sign In</div>

          {!isDeepLinkFlow && (
            <>
              <div className={viewStyles.description}>
                Does the verification number below match the one in the {targetConfig.explorerText}?
              </div>
              <div className={styles.code}>{requestRef.current?.code}</div>
            </>
          )}

          {isDeepLinkFlow && (
            <div className={viewStyles.description}>Please confirm you want to sign in to {targetConfig.explorerText}</div>
          )}

          <div className={styles.buttons}>
            <Button inverted disabled={isLoading} onClick={onDenyVerifySignIn} className={styles.noButton}>
              <Icon name="times circle" />
              {isDeepLinkFlow ? 'Cancel' : "No, it doesn't"}
            </Button>
            <Button inverted loading={isLoading} disabled={isLoading} onClick={onApproveSignInVerification} className={styles.yesButton}>
              <Icon name="check circle" />
              {isDeepLinkFlow ? 'Sign In' : 'Yes, they are the same'}
            </Button>
          </div>
          {hasTimedOut && (
            <div className={styles.timeoutMessage}>
              <ErrorOutlineIcon fontSize="large" sx={{ color: '#fb3b3b' }} />
              <div>
                You might be logged out of your wallet extension.
                <br />
                Please check that you're logged in and try again.
              </div>
            </div>
          )}
        </Container>
      )
    }

    case View.WALLET_NFT_INTERACTION:
      return nftTransferData ? (
        <>
          <Web2TransactionModal
            isOpen={isTransactionModalOpen}
            transactionCostAmount={formatEther((transactionGasCost ?? 0).toString())}
            userBalanceAmount={formatEther((walletInfo?.balance ?? 0).toString())}
            chainId={walletInfo?.chainId ?? ChainId.ETHEREUM_MAINNET}
            onAccept={onApproveWalletInteraction}
            onClose={onDenyWalletInteraction}
            onReject={onDenyWalletInteraction}
          />
          <NFTTransferView
            nftData={nftTransferData}
            isLoading={isLoading}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      ) : null
    case View.WALLET_MANA_INTERACTION:
      return manaTransferData ? (
        <>
          <Web2TransactionModal
            isOpen={isTransactionModalOpen}
            transactionCostAmount={formatEther((transactionGasCost ?? 0).toString())}
            userBalanceAmount={formatEther((walletInfo?.balance ?? 0).toString())}
            chainId={walletInfo?.chainId ?? ChainId.ETHEREUM_MAINNET}
            onAccept={onApproveWalletInteraction}
            onClose={onDenyWalletInteraction}
            onReject={onDenyWalletInteraction}
          />
          <MANATransferView
            manaData={manaTransferData}
            isLoading={isLoading}
            onDeny={onDenyWalletInteraction}
            onApprove={handleApproveWalletInteraction}
          />
        </>
      ) : null
    case View.WALLET_INTERACTION:
      return (
        <Container canChangeAccount requestId={requestId}>
          <Web2TransactionModal
            isOpen={isTransactionModalOpen}
            transactionCostAmount={formatEther((transactionGasCost ?? 0).toString())}
            userBalanceAmount={formatEther((walletInfo?.balance ?? 0).toString())}
            chainId={walletInfo?.chainId ?? ChainId.ETHEREUM_MAINNET}
            onAccept={onApproveWalletInteraction}
            onClose={onDenyWalletInteraction}
            onReject={onDenyWalletInteraction}
          />
          <div className={viewStyles.logo}></div>
          <div className={viewStyles.title}>
            {isUserUsingWeb2Wallet
              ? 'A scene wants to access your Decentraland account assets'
              : `The ${targetConfig.explorerText} wants to interact with your wallet`}
          </div>
          <div className={viewStyles.description}>Only proceed if you are aware of all transaction details and trust this scene.</div>
          <div className={styles.buttons}>
            <Button inverted disabled={isLoading} onClick={onDenyWalletInteraction}>
              Deny
            </Button>
            <Button primary disabled={isLoading} loading={isLoading} onClick={handleApproveWalletInteraction}>
              Allow
            </Button>
          </div>
        </Container>
      )
    default:
      return null
  }
}
