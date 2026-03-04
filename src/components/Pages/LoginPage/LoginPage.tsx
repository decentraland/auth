import { useState, useCallback, useMemo, useEffect, useContext } from 'react'
import classNames from 'classnames'
import type { AuthIdentity } from '@dcl/crypto'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { Env } from '@dcl/ui-env'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { connection } from 'decentraland-connect'
import ImageNew1 from '../../../assets/images/background/image-new1.webp'
import ImageNew2 from '../../../assets/images/background/image-new2.webp'
import ImageNew3 from '../../../assets/images/background/image-new3.webp'
import ImageNew4 from '../../../assets/images/background/image-new4.webp'
import ImageNew5 from '../../../assets/images/background/image-new5.webp'
import ImageNew6 from '../../../assets/images/background/image-new6.webp'
import Image1 from '../../../assets/images/background/image1.webp'
import Image10 from '../../../assets/images/background/image10.webp'
import Image2 from '../../../assets/images/background/image2.webp'
import Image3 from '../../../assets/images/background/image3.webp'
import Image4 from '../../../assets/images/background/image4.webp'
import Image5 from '../../../assets/images/background/image5.webp'
import Image6 from '../../../assets/images/background/image6.webp'
import Image7 from '../../../assets/images/background/image7.webp'
import Image8 from '../../../assets/images/background/image8.webp'
import Image9 from '../../../assets/images/background/image9.webp'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useAuthFlow } from '../../../hooks/useAuthFlow'
import { useAutoLogin } from '../../../hooks/useAutoLogin'
import { ConnectionType } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { isErrorWithName } from '../../../shared/errors'
import { extractReferrerFromSearchParameters } from '../../../shared/locations'
import { disconnectWallet, sendEmailOTP } from '../../../shared/thirdweb'
import { isClockSynchronized } from '../../../shared/utils/clockSync'
import { handleError } from '../../../shared/utils/errorHandler'
import { ClockSyncModal } from '../../ClockSyncModal'
import { ConnectionOptionType, Connection } from '../../Connection'
import { ConnectionModal } from '../../ConnectionModal'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { EmailLoginModal } from '../../EmailLoginModal'
import { EmailLoginResult } from '../../EmailLoginModal/EmailLoginModal.types'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { ConfirmingLogin } from './ConfirmingLogin'
import {
  getIdentitySignature,
  getIdentityWithSigner,
  connectToProvider,
  isSocialLogin,
  fromConnectionOptionToProviderType,
  connectToSocialProvider
} from './utils'
import styles from './LoginPage.module.css'

const BACKGROUND_IMAGES = [Image1, Image2, Image3, Image4, Image5, Image6, Image7, Image8, Image9, Image10]
const NEW_USER_BACKGROUND_IMAGES = [ImageNew1, ImageNew2, ImageNew3, ImageNew4, ImageNew5, ImageNew6]
const NEW_USER_PARAM_VARIANTS = ['newUser', 'newuser', 'new-user', 'new_user']

export const LoginPage = () => {
  const [isNewUser, setIsNewUser] = useState(
    NEW_USER_PARAM_VARIANTS.some(variant => new URLSearchParams(window.location.search).has(variant))
  )

  const [loadingState, setLoadingState] = useState(ConnectionLayoutState.CONNECTING_WALLET)
  const [showConnectionLayout, setShowConnectionLayout] = useState(false)
  const [showClockSyncModal, setShowClockSyncModal] = useState(false)
  const [showEmailLoginModal, setShowEmailLoginModal] = useState(false)
  const [currentConnectionType, setCurrentConnectionType] = useState<ConnectionOptionType>()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { initialized: flagInitialized, flags } = useContext(FeatureFlagsContext)

  // Check if email OTP login is enabled via feature flag
  const isEmailOtpEnabled = flags[FeatureFlagsKeys.EMAIL_OTP_LOGIN] === true

  // Email login state
  const [currentEmail, setCurrentEmail] = useState('')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showConfirmingLogin, setShowConfirmingLogin] = useState(false)
  const [confirmingLoginError, setConfirmingLoginError] = useState<string | null>(null)
  // Store address from email login for clock sync continuation
  const [emailLoginAddress, setEmailLoginAddress] = useState<string | null>(null)

  // TODO: remove /play from redirectTo. Build guest URL only when redirect path includes /play; use its presence to show the option.
  const guestRedirectToURL = useMemo(() => {
    if (!redirectTo) return ''
    try {
      const url = redirectTo.startsWith('/') ? new URL(redirectTo, window.location.origin) : new URL(redirectTo)
      if (!url.pathname.includes('/play')) return ''
      url.searchParams.append('guest', 'true')
      return url.toString()
    } catch {
      return ''
    }
  }, [redirectTo])

  const showGuestOption = !!guestRedirectToURL

  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0)
  const [targetConfig] = useTargetConfig()
  const { checkProfileAndRedirect } = useAuthFlow()
  const { trackLoginClick, trackLoginSuccess, trackGuestLogin } = useAnalytics()

  const handleGuestLogin = useCallback(async () => {
    await trackGuestLogin()
  }, [trackGuestLogin])

  const getReferrerFromCurrentSearch = useCallback(() => {
    const search = new URLSearchParams(window.location.search)
    return extractReferrerFromSearchParameters(search)
  }, [])

  const runProfileRedirect = useCallback(
    async (account: string, referrer: string | null, identity: AuthIdentity | null = null, onRedirect?: () => void) => {
      await checkProfileAndRedirect(
        account,
        referrer,
        () => {
          redirect()
          onRedirect?.()
        },
        identity
      )
    },
    [checkProfileAndRedirect, redirect]
  )

  const checkClockSynchronization = useCallback(async (): Promise<boolean> => {
    try {
      const httpClient = createAuthServerHttpClient()
      const healthData = await httpClient.checkHealth()
      const isSync = isClockSynchronized(healthData.timestamp)

      if (!isSync) {
        setShowConnectionLayout(false)
        setShowClockSyncModal(true)
        return false
      }

      return true
    } catch (error) {
      handleError(error, 'Error checking clock synchronization')
      // If we can't check the clock, proceed with normal flow
      return true
    }
  }, [])

  // Handle email submit from the main page
  const handleEmailSubmit = useCallback(
    async (email: string) => {
      setCurrentEmail(email)
      setIsEmailLoading(true)
      setEmailError(null)
      setCurrentConnectionType(ConnectionOptionType.EMAIL)

      trackLoginClick({
        method: ConnectionOptionType.EMAIL,
        type: ConnectionType.WEB2
      })

      // Avoid stale connection/account from a previous wallet session.
      try {
        await connection.disconnect()
        await disconnectWallet()
      } catch {
        // Keep the flow going even if cleanup fails.
      }

      try {
        // Send OTP to email
        await sendEmailOTP(email)
        // Open OTP modal
        setShowEmailLoginModal(true)
      } catch (error) {
        const errorMessage = handleError(error, 'Error sending verification code')
        // Handle network errors with a user-friendly message
        if (errorMessage === 'Failed to fetch' || errorMessage?.toLowerCase().includes('network')) {
          setEmailError('Unable to connect. Please check your internet connection and try again.')
        } else {
          setEmailError(errorMessage || 'Failed to send verification code. Please try again.')
        }
      } finally {
        setIsEmailLoading(false)
      }
    },
    [trackLoginClick]
  )

  const handleOnConnect = useCallback(
    async (connectionType: ConnectionOptionType) => {
      if (!flagInitialized) {
        return
      }

      // EMAIL is handled differently - focus the email input instead of connecting
      // But only if email OTP is enabled
      if (connectionType === ConnectionOptionType.EMAIL) {
        if (!isEmailOtpEnabled) {
          // Email OTP is disabled via feature flag, ignore this auto-login attempt
          return
        }
        const emailInput = document.getElementById('dcl-email-input')
        if (emailInput) {
          emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
          emailInput.focus()
        }
        return
      }

      const isLoggingInThroughSocial = isSocialLogin(connectionType)
      const providerType = isLoggingInThroughSocial ? ConnectionType.WEB2 : ConnectionType.WEB3
      setCurrentConnectionType(connectionType)

      trackLoginClick({
        method: connectionType,
        type: providerType
      })

      try {
        if (isLoggingInThroughSocial) {
          setLoadingState(ConnectionLayoutState.LOADING_MAGIC)
          await connectToSocialProvider(connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo)
        } else {
          setShowConnectionLayout(true)
          setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)

          setLoadingState(ConnectionLayoutState.WAITING_FOR_SIGNATURE)
          if (!connectionData.provider) {
            throw new Error('Provider is required for wallet connections')
          }
          await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)

          await trackLoginSuccess({
            ethAddress: connectionData.account ?? undefined,
            type: providerType
          })

          const referrer = getReferrerFromCurrentSearch()

          const isClockSync = await checkClockSynchronization()

          if (isClockSync) {
            await runProfileRedirect(connectionData.account ?? '', referrer, null, () => setShowConnectionLayout(false))
          }
        }
      } catch (error) {
        handleError(error, 'Error during login connection', {
          sentryTags: {
            isWeb2Wallet: isLoggingInThroughSocial,
            connectionType
          }
        })

        if (isErrorWithName(error) && error.name === 'ErrorUnlockingWallet') {
          setLoadingState(ConnectionLayoutState.ERROR_LOCKED_WALLET)
        } else {
          setLoadingState(ConnectionLayoutState.ERROR)
        }
      }
    },
    [
      setLoadingState,
      setShowConnectionLayout,
      setCurrentConnectionType,
      redirectTo,
      flags[FeatureFlagsKeys.MAGIC_TEST],
      trackLoginClick,
      trackLoginSuccess,
      runProfileRedirect,
      flagInitialized,
      checkClockSynchronization,
      getReferrerFromCurrentSearch,
      isEmailOtpEnabled
    ]
  )

  const handleOnCloseConnectionModal = useCallback(() => {
    setShowConnectionLayout(false)
    setCurrentConnectionType(undefined)
    setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
  }, [setShowConnectionLayout])

  const handleEmailLoginClose = useCallback(() => {
    setShowEmailLoginModal(false)
  }, [])

  const handleEmailLoginBack = useCallback(() => {
    setShowEmailLoginModal(false)
    setCurrentEmail('')
    setCurrentConnectionType(undefined)
  }, [])

  const handleEmailLoginSuccess = useCallback(
    async (result: EmailLoginResult) => {
      setShowEmailLoginModal(false)
      setShowConfirmingLogin(true)
      setConfirmingLoginError(null)

      try {
        const { account } = result
        const address = account.address.toLowerCase()

        // Store address for clock sync continuation
        setEmailLoginAddress(address)

        // Generate identity using the thirdweb account's signMessage
        const freshIdentity = await getIdentityWithSigner(address, async (message: string) => account.signMessage({ message }))

        // Ensure connector session matches the OTP-authenticated account.
        const thirdwebConnection = await connection.connect(ProviderType.THIRDWEB, ChainId.ETHEREUM_MAINNET)
        const connectedAddress = thirdwebConnection.account?.toLowerCase() ?? ''
        if (!connectedAddress) {
          throw new Error('Thirdweb connection did not return a connected account')
        }
        if (connectedAddress !== address) {
          throw new Error('Detected a different account session than the verified email. Please try logging in again.')
        }

        await trackLoginSuccess({
          ethAddress: address,
          type: ConnectionType.WEB2
        })

        const referrer = getReferrerFromCurrentSearch()

        const isClockSync = await checkClockSynchronization()

        if (isClockSync) {
          await runProfileRedirect(address, referrer, freshIdentity, () => setShowConfirmingLogin(false))
        } else {
          // Clock sync failed - hide confirming overlay so modal is visible
          setShowConfirmingLogin(false)
        }
      } catch (error) {
        const errorMessage = handleError(error, 'Error completing email login', {
          sentryTags: {
            connectionType: ConnectionOptionType.EMAIL
          }
        })
        setConfirmingLoginError(errorMessage || 'Something went wrong. Please try again.')
      }
    },
    [trackLoginSuccess, checkClockSynchronization, runProfileRedirect, getReferrerFromCurrentSearch]
  )

  const handleEmailLoginError = useCallback((error: string) => {
    handleError(new Error(error), 'Email login error')
  }, [])

  const handleConfirmingLoginRetry = useCallback(() => {
    setShowConfirmingLogin(false)
    setConfirmingLoginError(null)
    // Go back to the email login modal with the current email
    setShowEmailLoginModal(true)
  }, [])

  // Use the auto-login hook to handle loginMethod URL parameter
  useAutoLogin({
    isReady: flagInitialized,
    onConnect: handleOnConnect
  })

  const handleTryAgain = useCallback(() => {
    if (currentConnectionType) {
      handleOnConnect(currentConnectionType)
    }
  }, [currentConnectionType, handleOnConnect])

  const handleClockSyncContinue = useCallback(async () => {
    setShowClockSyncModal(false)

    const referrer = getReferrerFromCurrentSearch()

    // Handle EMAIL login separately - use stored address instead of connectToProvider
    if (currentConnectionType === ConnectionOptionType.EMAIL && emailLoginAddress) {
      try {
        const freshIdentity = localStorageGetIdentity(emailLoginAddress)
        await runProfileRedirect(emailLoginAddress, referrer, freshIdentity)
      } catch (error) {
        handleError(error, 'Error during email clock sync continue flow')
      }
      return
    }

    // Handle other connection types via connectToProvider
    if (currentConnectionType) {
      try {
        const connectionData = await connectToProvider(currentConnectionType)

        await runProfileRedirect(connectionData.account ?? '', referrer, null, () => setShowConnectionLayout(false))
      } catch (error) {
        handleError(error, 'Error during clock sync continue flow')
      }
    }
  }, [currentConnectionType, emailLoginAddress, runProfileRedirect, getReferrerFromCurrentSearch])

  useEffect(() => {
    const backgroundInterval = setInterval(() => {
      setCurrentBackgroundIndex(index => {
        if (index === (isNewUser ? NEW_USER_BACKGROUND_IMAGES.length - 1 : BACKGROUND_IMAGES.length - 1)) {
          return 0
        }
        return index + 1
      })
    }, 5000)
    return () => {
      clearInterval(backgroundInterval)
    }
  }, [])

  return (
    <main className={classNames(styles.main, isNewUser && styles.newUserMain)}>
      <div
        className={styles.background}
        style={{
          backgroundImage: `url(${
            isNewUser ? NEW_USER_BACKGROUND_IMAGES[currentBackgroundIndex] : BACKGROUND_IMAGES[currentBackgroundIndex]
          })`
        }}
      />
      {showConfirmingLogin && !showClockSyncModal && (
        <ConfirmingLogin error={confirmingLoginError} onError={confirmingLoginError ? handleConfirmingLoginRetry : undefined} />
      )}
      {config.is(Env.DEVELOPMENT) && !flagInitialized ? (
        <Loader active size="massive" />
      ) : (
        <>
          <ClockSyncModal open={showClockSyncModal} onContinue={handleClockSyncContinue} onClose={handleClockSyncContinue} />
          <ConnectionModal
            open={showConnectionLayout}
            state={loadingState}
            onClose={handleOnCloseConnectionModal}
            onTryAgain={handleTryAgain}
            providerType={currentConnectionType ? fromConnectionOptionToProviderType(currentConnectionType) : null}
          />
          {isEmailOtpEnabled && (
            <EmailLoginModal
              open={showEmailLoginModal}
              email={currentEmail}
              onClose={handleEmailLoginClose}
              onBack={handleEmailLoginBack}
              onSuccess={handleEmailLoginSuccess}
              onError={handleEmailLoginError}
            />
          )}
          <div className={styles.left}>
            <div className={styles.leftInfo}>
              <div className={styles.mainContainer}>
                <Connection
                  onConnect={handleOnConnect}
                  onEmailSubmit={isEmailOtpEnabled ? handleEmailSubmit : undefined}
                  loadingOption={currentConnectionType}
                  connectionOptions={targetConfig.connectionOptions}
                  isNewUser={isNewUser}
                  isEmailLoading={isEmailLoading}
                  emailError={emailError}
                />
                {isNewUser && (
                  <div className={styles.newUserInfo}>
                    Already have an account? <span onClick={() => setIsNewUser(false)}>Sign In</span>
                  </div>
                )}
              </div>
              {showGuestOption && (
                <div className={styles.guestInfo}>
                  Quick dive?{' '}
                  <a href={guestRedirectToURL} onClick={handleGuestLogin}>
                    Explore as a guest
                  </a>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
