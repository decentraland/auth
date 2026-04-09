import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthIdentity } from '@dcl/crypto'
import { useTranslation } from '@dcl/hooks'
import { connection } from 'decentraland-connect'
import { CircularProgress, Desktop } from 'decentraland-ui2'
// eslint-disable-next-line @typescript-eslint/naming-convention
import ImageNew1 from '../../../assets/images/background/image-new1.webp'
// eslint-disable-next-line @typescript-eslint/naming-convention
import ImageNew2 from '../../../assets/images/background/image-new2.webp'
// eslint-disable-next-line @typescript-eslint/naming-convention
import ImageNew3 from '../../../assets/images/background/image-new3.webp'
// eslint-disable-next-line @typescript-eslint/naming-convention
import ImageNew4 from '../../../assets/images/background/image-new4.webp'
// eslint-disable-next-line @typescript-eslint/naming-convention
import ImageNew5 from '../../../assets/images/background/image-new5.webp'
// eslint-disable-next-line @typescript-eslint/naming-convention
import ImageNew6 from '../../../assets/images/background/image-new6.webp'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { VALID_LOGIN_METHODS, mapLoginMethodToConnectionOption, useAutoLogin } from '../../../hooks/useAutoLogin'
import type { LoginMethod } from '../../../hooks/useAutoLogin'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { ConnectionType } from '../../../modules/analytics/types'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isErrorWithName, isUserRejectedTransaction } from '../../../shared/errors'
import { extractReferrerFromSearchParameters } from '../../../shared/locations'
import { markReturningUser } from '../../../shared/onboarding/markReturningUser'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { disconnectWallet, sendEmailOTP } from '../../../shared/thirdweb'
import { isClockSynchronized } from '../../../shared/utils/clockSync'
import { handleError } from '../../../shared/utils/errorHandler'
import { ClockSyncModal } from '../../ClockSyncModal'
import { Connection, ConnectionOptionType } from '../../Connection'
import { ConnectionModal } from '../../ConnectionModal'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { EmailLoginModal } from '../../EmailLoginModal'
import { EmailLoginResult } from '../../EmailLoginModal/EmailLoginModal.types'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { ConfirmingLogin } from './ConfirmingLogin'
import { SocialAutoLoginRedirect } from './SocialAutoLoginRedirect'
import {
  connectToProvider,
  connectToSocialProvider,
  fromConnectionOptionToProviderType,
  getSignInOptionsMode,
  isSocialLogin,
  requiresInjectedProvider
} from './utils'
import { Background, BackgroundWrapper, GuestInfo, Left, LeftInfo, Main, MainContainer, NewUserInfo } from './LoginPage.styled'

const NEW_USER_BACKGROUND_IMAGES = [ImageNew1, ImageNew2, ImageNew3, ImageNew4, ImageNew5, ImageNew6]
const NEW_USER_PARAM_VARIANTS = ['newUser', 'newuser', 'new-user', 'new_user']

export const LoginPage = () => {
  const { t } = useTranslation()
  const [isNewUser, setIsNewUser] = useState(
    NEW_USER_PARAM_VARIANTS.some(variant => new URLSearchParams(window.location.search).has(variant))
  )

  const [loadingState, setLoadingState] = useState(ConnectionLayoutState.CONNECTING_WALLET)
  const [showConnectionLayout, setShowConnectionLayout] = useState(false)
  const [showClockSyncModal, setShowClockSyncModal] = useState(false)
  const [showEmailLoginModal, setShowEmailLoginModal] = useState(false)
  const [currentConnectionType, setCurrentConnectionType] = useState<ConnectionOptionType>()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { initialized: flagInitialized, flags, variants } = useContext(FeatureFlagsContext)

  const signInOptionsMode = getSignInOptionsMode(variants)

  // Email login state
  const [currentEmail, setCurrentEmail] = useState('')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showConfirmingLogin, setShowConfirmingLogin] = useState(false)
  const [confirmingLoginError, setConfirmingLoginError] = useState<string | null>(null)

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
  const [previousBackgroundIndex, setPreviousBackgroundIndex] = useState(0)
  const [backgroundTransitioning, setBackgroundTransitioning] = useState(false)
  const [targetConfig] = useTargetConfig()
  const { ensureProfile } = useEnsureProfile()
  const { identity, getIdentitySignature } = useCurrentConnectionData()
  const { trackLoginClick, trackLoginSuccess, trackGuestLogin } = useAnalytics()

  const handleGuestLogin = useCallback(async () => {
    await trackGuestLogin()
  }, [trackGuestLogin])

  const getReferrerFromCurrentSearch = useCallback(() => {
    const search = new URLSearchParams(window.location.search)
    return extractReferrerFromSearchParameters(search)
  }, [])

  const runProfileRedirect = useCallback(
    async (account: string, referrer: string | null, providedIdentity: AuthIdentity | null = null, onRedirect?: () => void) => {
      if (targetConfig && !targetConfig.skipSetup && account) {
        const userIdentity = providedIdentity ?? identity
        const profile = await ensureProfile(account, userIdentity, { redirectTo, referrer })
        if (!profile) return
      }

      markReturningUser(account)
      redirect()
      onRedirect?.()
    },
    [targetConfig?.skipSetup, redirectTo, identity, ensureProfile, redirect]
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

      trackCheckpoint({
        checkpointId: 2,
        action: 'reached',
        source: 'auth',
        userIdentifier: email,
        identifierType: 'email',
        email,
        metadata: { loginMethod: ConnectionOptionType.EMAIL }
      })

      try {
        // Send OTP to email
        await sendEmailOTP(email)
        // Open OTP modal
        setShowEmailLoginModal(true)
      } catch (error) {
        const errorMessage = handleError(error, 'Error sending verification code')
        // Clear connection type so other login options aren't disabled
        setCurrentConnectionType(undefined)
        // Handle known API errors with translated messages
        if (errorMessage === 'Failed to fetch' || errorMessage?.toLowerCase().includes('network')) {
          setEmailError(t('login.errors.network_error'))
        } else if (errorMessage?.toLowerCase().includes('invalid email')) {
          setEmailError(t('login.errors.invalid_email'))
        } else {
          setEmailError(errorMessage || t('login.errors.failed_send_code'))
        }
      } finally {
        setIsEmailLoading(false)
      }
    },
    [trackLoginClick, t]
  )

  const handleOnConnect = useCallback(
    async (connectionType: ConnectionOptionType) => {
      if (!flagInitialized) {
        return
      }

      // EMAIL is handled differently - focus the email input instead of connecting
      if (connectionType === ConnectionOptionType.EMAIL) {
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
          // CP2 reached is tracked from CallbackPage after the OAuth redirect returns
          // (at this point we don't have the user's email or wallet yet)
          setLoadingState(ConnectionLayoutState.LOADING_MAGIC)
          await connectToSocialProvider(connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo)
        } else {
          if (requiresInjectedProvider(connectionType) && !window.ethereum) {
            throw new Error('No wallet extension detected. Please install MetaMask or another Ethereum wallet.')
          }
          setShowConnectionLayout(true)
          setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)

          // Track CP2 reached after wallet connects so we have the account address
          trackCheckpoint({
            checkpointId: 2,
            action: 'reached',
            source: 'auth',
            userIdentifier: connectionData.account?.toLowerCase() ?? '',
            identifierType: 'wallet',
            wallet: connectionData.account?.toLowerCase(),
            metadata: { loginMethod: connectionType }
          })

          setLoadingState(ConnectionLayoutState.WAITING_FOR_SIGNATURE)
          const freshIdentity = await getIdentitySignature(connectionData)

          // Clear any stored social login emails since this is a wallet login
          localStorage.removeItem('dcl_thirdweb_user_email')
          localStorage.removeItem('dcl_magic_user_email')

          await trackLoginSuccess({
            ethAddress: connectionData.account ?? undefined,
            type: providerType
          })

          const referrer = getReferrerFromCurrentSearch()

          const isClockSync = await checkClockSynchronization()

          if (isClockSync) {
            await runProfileRedirect(connectionData.account ?? '', referrer, freshIdentity, () => setShowConnectionLayout(false))
          }
        }
      } catch (error) {
        if (isUserRejectedTransaction(error)) {
          console.info('User rejected login signature in wallet — not reporting to Sentry')
        } else {
          handleError(error, 'Error during login connection', {
            sentryTags: {
              isWeb2Wallet: isLoggingInThroughSocial,
              connectionType
            }
          })
        }

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
      getIdentitySignature
    ]
  )

  const handleOnCloseConnectionModal = useCallback(() => {
    setShowConnectionLayout(false)
    setCurrentConnectionType(undefined)
    setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
  }, [setShowConnectionLayout])

  const handleEmailLoginClose = useCallback(() => {
    setShowEmailLoginModal(false)
    setCurrentEmail('')
    setCurrentConnectionType(undefined)
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
        const address = result.address.toLowerCase()

        const freshIdentity = await getIdentitySignature()

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
        setConfirmingLoginError(errorMessage || t('login.errors.something_went_wrong'))
      }
    },
    [trackLoginSuccess, checkClockSynchronization, runProfileRedirect, getReferrerFromCurrentSearch, getIdentitySignature, t]
  )

  const handleEmailInputChange = useCallback(() => {
    setEmailError(null)
  }, [])

  const handleEmailLoginError = useCallback((error: string) => {
    handleError(new Error(error), 'Email login error')
  }, [])

  const handleConfirmingLoginRetry = useCallback(() => {
    setShowConfirmingLogin(false)
    setConfirmingLoginError(null)
    // Go back to the email login modal with the current email
    setShowEmailLoginModal(true)
  }, [])

  // When loginMethod is a social provider, skip the full login UI and redirect immediately to OAuth.
  // The full page (backgrounds, connection options, modals) is unnecessary since we just redirect away.
  const socialAutoLoginType = useMemo(() => {
    const param = new URLSearchParams(window.location.search).get('loginMethod')?.toLowerCase()
    if (!param || !VALID_LOGIN_METHODS.includes(param as LoginMethod)) return null
    const connectionOption = mapLoginMethodToConnectionOption(param as LoginMethod)
    return isSocialLogin(connectionOption) ? connectionOption : null
  }, [])

  // Use the auto-login hook to handle loginMethod URL parameter for non-social methods.
  // Disabled when socialAutoLoginType is set to avoid a duplicate connectToSocialProvider call.
  useAutoLogin({
    isReady: flagInitialized && !socialAutoLoginType,
    onConnect: handleOnConnect
  })

  const handleTryAgain = useCallback(() => {
    if (currentConnectionType) {
      handleOnConnect(currentConnectionType)
    }
  }, [currentConnectionType, handleOnConnect])

  const handleClockSyncContinue = useCallback(async () => {
    setShowClockSyncModal(false)

    if (!currentConnectionType) return

    const referrer = getReferrerFromCurrentSearch()

    if (requiresInjectedProvider(currentConnectionType) && !window.ethereum) {
      handleError(new Error('No wallet extension detected'), 'Wallet extension not available for clock sync continue')
      return
    }

    try {
      const connectionData = await connectToProvider(currentConnectionType)
      await runProfileRedirect(connectionData.account ?? '', referrer, null, () => setShowConnectionLayout(false))
    } catch (error) {
      handleError(error, 'Error during clock sync continue flow')
    }
  }, [currentConnectionType, runProfileRedirect, getReferrerFromCurrentSearch])

  useEffect(() => {
    const images = NEW_USER_BACKGROUND_IMAGES
    const maxIndex = images.length - 1
    const backgroundInterval = setInterval(() => {
      setCurrentBackgroundIndex(prev => {
        setPreviousBackgroundIndex(prev)
        setBackgroundTransitioning(true)
        return prev >= maxIndex ? 0 : prev + 1
      })
    }, 5000)
    return () => clearInterval(backgroundInterval)
  }, [])

  useEffect(() => {
    if (!backgroundTransitioning) return
    const t = setTimeout(() => {
      setPreviousBackgroundIndex(currentBackgroundIndex)
      setBackgroundTransitioning(false)
    }, 1000)
    return () => clearTimeout(t)
  }, [backgroundTransitioning, currentBackgroundIndex])

  // Wait for feature flags before rendering the page. This guarantees that any callback
  // triggered by user interaction (e.g. handleEmailLoginSuccess → checkProfileAndRedirect)
  // will have access to initialized flags. If you add new flag-dependent logic to this
  // page, this loader must remain in place.
  if (!flagInitialized) {
    return (
      <Main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={80} />
      </Main>
    )
  }

  if (socialAutoLoginType) {
    return <SocialAutoLoginRedirect connectionType={socialAutoLoginType} />
  }

  const backgroundImages = NEW_USER_BACKGROUND_IMAGES
  return (
    <Main>
      <Desktop>
        <BackgroundWrapper>
          <Background
            isVisible={true}
            style={{
              backgroundImage: `url(${backgroundImages[previousBackgroundIndex]})`
            }}
            aria-hidden
          />
          <Background
            isVisible={backgroundTransitioning}
            style={{
              backgroundImage: `url(${backgroundImages[currentBackgroundIndex]})`
            }}
            aria-hidden
          />
        </BackgroundWrapper>
      </Desktop>
      {showConfirmingLogin && !showClockSyncModal && (
        <ConfirmingLogin error={confirmingLoginError} onError={confirmingLoginError ? handleConfirmingLoginRetry : undefined} />
      )}
      <ClockSyncModal open={showClockSyncModal} onContinue={handleClockSyncContinue} onClose={handleClockSyncContinue} />
      <ConnectionModal
        open={showConnectionLayout}
        state={loadingState}
        onClose={handleOnCloseConnectionModal}
        onTryAgain={handleTryAgain}
        providerType={currentConnectionType ? fromConnectionOptionToProviderType(currentConnectionType) : null}
      />
      <EmailLoginModal
        open={showEmailLoginModal}
        email={currentEmail}
        onClose={handleEmailLoginClose}
        onBack={handleEmailLoginBack}
        onSuccess={handleEmailLoginSuccess}
        onError={handleEmailLoginError}
      />
      <Left>
        <LeftInfo>
          <MainContainer>
            <Connection
              onConnect={handleOnConnect}
              onEmailSubmit={handleEmailSubmit}
              onEmailChange={handleEmailInputChange}
              loadingOption={currentConnectionType}
              connectionOptions={targetConfig.connectionOptions}
              isNewUser={isNewUser}
              signInOptionsMode={signInOptionsMode}
              isEmailLoading={isEmailLoading}
              emailError={emailError}
            />
            {isNewUser && (
              <NewUserInfo>
                {t('login.already_have_account')} <span onClick={() => setIsNewUser(false)}>{t('login.sign_in')}</span>
              </NewUserInfo>
            )}
          </MainContainer>
          {showGuestOption && (
            <GuestInfo>
              {t('login.quick_dive')}{' '}
              <a href={guestRedirectToURL} onClick={handleGuestLogin}>
                {t('login.explore_as_guest')}
              </a>
            </GuestInfo>
          )}
        </LeftInfo>
      </Left>
    </Main>
  )
}
