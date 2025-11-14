import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { ethers, BrowserProvider, formatEther } from 'ethers'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { ChainId } from '@dcl/schemas'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Web2TransactionModal } from 'decentraland-ui/dist/components/Web2TransactionModal'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile, fetchProfileWithConsistencyCheck, redeployExistingProfile } from '../../../modules/profile'
import {
  createAuthServerHttpClient,
  createAuthServerWsClient,
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
import { DeniedSignIn } from './Views/DeniedSignIn'
import { DeniedWalletInteraction } from './Views/DeniedWalletInteraction'
import { DifferentAccountError } from './Views/DifferentAccountError'
import { IpValidationError as IpValidationErrorView } from './Views/IpValidationError'
import { RecoverError } from './Views/RecoverError'
import { SignInComplete } from './Views/SignInComplete'
import { SigningError } from './Views/SigningError'
import { TimeoutError } from './Views/TimeoutError'
import viewStyles from './Views/Views.module.css'
import { WalletInteractionComplete } from './Views/WalletInteractionComplete'
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
  // Wallet Interaction
  WALLET_INTERACTION,
  WALLET_INTERACTION_DENIED,
  WALLET_INTERACTION_ERROR,
  WALLET_INTERACTION_COMPLETE
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
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const requestRef = useRef<RecoverResponse>()
  const [error, setError] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const signTimeoutRef = useRef<NodeJS.Timeout>()
  const requestId = params.requestId ?? ''
  const [targetConfig, targetConfigId] = useTargetConfig()
  const isUserUsingWeb2Wallet = !!provider?.isMagic
  const authServerClient = useRef(createAuthServerWsClient())

  // Goes to the login page where the user will have to connect a wallet.
  const toLoginPage = useCallback(() => {
    navigate(locations.login(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}`))
  }, [requestId])

  const toSetupPage = useCallback(async () => {
    const referrer = extractReferrerFromSearchParameters(searchParams)

    // Check A/B testing new onboarding flow
    const isFlowV2OnboardingFlowEnabled = variants[FeatureFlagsKeys.ONBOARDING_FLOW]?.name === OnboardingFlowVariant.V2

    const hasWebGPU = await checkWebGpuSupport()
    const isAvatarSetupFlowAllowed = isFlowV2OnboardingFlowEnabled && hasWebGPU
    if (isAvatarSetupFlowAllowed) {
      navigate(locations.avatarSetup(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}`, referrer))
    } else {
      navigate(locations.setup(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}`, referrer))
    }
  }, [requestId, variants[FeatureFlagsKeys.ONBOARDING_FLOW], searchParams])

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

    // Initialize the auth server client.
    if (flags[FeatureFlagsKeys.HTTP_AUTH]) {
      authServerClient.current = createAuthServerHttpClient()
    }

    const loadRequest = async () => {
      const timeTheSiteStartedLoading = Date.now()
      browserProvider.current = new ethers.BrowserProvider(provider)

      const consistencyResult = await fetchProfileWithConsistencyCheck(account)
      console.log('Loading request - Consistency result', consistencyResult)
      if (!consistencyResult.isConsistent && consistencyResult.entity && identity) {
        try {
          await redeployExistingProfile(consistencyResult.entity, account, identity)
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
        const request = await authServerClient.current.recover(requestId, signerAddress)
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
          case 'eth_sendTransaction':
            try {
              const signer = await browserProvider.current.getSigner()
              const userBalance = await browserProvider.current.getBalance(signer.address)
              setWalletInfo({
                balance: userBalance,
                chainId: await browserProvider.current.getNetwork().then(network => Number(network.chainId))
              })
              const gasPrice = (await browserProvider.current.getFeeData()).gasPrice ?? BigInt(0)
              const transactionGasCost = await signer.estimateGas(request.params?.[0])
              const totalGasCost = gasPrice * transactionGasCost
              setTransactionGasCost(totalGasCost)
            } catch (e) {
              console.error('Error estimating gas', e)
            } finally {
              setView(View.WALLET_INTERACTION)
            }
            break
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
    if (view !== View.VERIFY_SIGN_IN && view !== View.WALLET_INTERACTION) {
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

      console.log('Approve sign in verification - Signed the message. Sending the outcome to the server...')
      await authServerClient.current.sendSuccessfulOutcome(requestId, await signer.getAddress(), signature)
      console.log('Approve sign in verification - Outcome sent')

      setView(View.VERIFY_SIGN_IN_COMPLETE)

      if (targetConfig.deepLink) {
        window.location.href = targetConfig.deepLink
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
  }, [setIsLoading, isUserUsingWeb2Wallet, isLoading])

  const onDenyWalletInteraction = useCallback(() => {
    setIsTransactionModalOpen(false)
    trackClick(ClickEvents.DENY_WALLET_INTERACTION)
    setView(View.WALLET_INTERACTION_DENIED)
  }, [])

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
      const result = await provider.send(requestRef.current?.method, requestRef.current?.params ?? [])
      trackClick(ClickEvents.APPROVE_WALLET_INTERACTION, {
        method: requestRef.current?.method
      })
      await authServerClient.current.sendSuccessfulOutcome(requestId, await signer.getAddress(), result)
      setView(View.WALLET_INTERACTION_COMPLETE)
    } catch (e) {
      if (e instanceof IpValidationError) {
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.IP_VALIDATION_ERROR)
      } else {
        handleError(e, 'Wallet interaction error', {
          sentryTags: { isWeb2Wallet: isUserUsingWeb2Wallet }
        })
        const signer = await browserProvider.current?.getSigner()
        if (signer && isRpcError(e)) {
          await authServerClient.current.sendFailedOutcome(requestId, await signer.getAddress(), e.error)
        } else if (signer && !isRpcError(e)) {
          await authServerClient.current.sendFailedOutcome(requestId, await signer.getAddress(), {
            code: 999,
            message: isErrorWithMessage(e) ? e.message : 'Unknown error'
          })
        }
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.WALLET_INTERACTION_ERROR)
      }
    }
  }, [isUserUsingWeb2Wallet])

  const handleApproveWalletInteraction = useCallback(async () => {
    if (isUserUsingWeb2Wallet) {
      setIsTransactionModalOpen(true)
    } else {
      await onApproveWalletInteraction()
    }
  }, [isUserUsingWeb2Wallet, onApproveWalletInteraction])

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
    case View.VERIFY_SIGN_IN_DENIED:
      return <DeniedSignIn requestId={requestId} />
    case View.WALLET_INTERACTION_COMPLETE:
      return <WalletInteractionComplete />
    case View.WALLET_INTERACTION_DENIED:
      return <DeniedWalletInteraction />
    case View.LOADING_REQUEST:
      return (
        <Container>
          <Loader active size="huge" />
        </Container>
      )
    case View.VERIFY_SIGN_IN:
      return (
        <Container canChangeAccount requestId={requestId}>
          <div className={viewStyles.logo}></div>
          <div className={viewStyles.title}>Verify Sign In</div>
          <div className={viewStyles.description}>Does the verification number below match the one in the {targetConfig.explorerText}?</div>
          <div className={styles.code}>{requestRef.current?.code}</div>
          <div className={styles.buttons}>
            <Button inverted disabled={isLoading} onClick={onDenyVerifySignIn} className={styles.noButton}>
              <Icon name="times circle" />
              No, it doesn't
            </Button>
            <Button inverted loading={isLoading} disabled={isLoading} onClick={onApproveSignInVerification} className={styles.yesButton}>
              <Icon name="check circle" />
              Yes, they are the same
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
