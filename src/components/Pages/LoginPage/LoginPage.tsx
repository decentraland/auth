import { MouseEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useAutoLogin } from '../../../hooks/useAutoLogin'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { usePostLoginRedirect } from '../../../hooks/usePostLoginRedirect'
import { ConnectionType } from '../../../modules/analytics/types'
import { getCurrentConnectionData, useCurrentConnectionData } from '../../../shared/connection'
import { isErrorWithName, isUserRejectedTransaction } from '../../../shared/errors'
import { extractReferrerFromSearchParameters } from '../../../shared/locations'
import { markReturningUser } from '../../../shared/onboarding/markReturningUser'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { disconnectWallet, sendEmailOTP } from '../../../shared/thirdweb'
import { checkClockSync } from '../../../shared/utils/clockSync'
import { handleError } from '../../../shared/utils/errorHandler'
import { ClockSyncModal } from '../../ClockSyncModal'
import { Connection, ConnectionOptionType } from '../../Connection'
import { ConnectionModal } from '../../ConnectionModal'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { EmailLoginModal } from '../../EmailLoginModal'
import { EmailLoginResult } from '../../EmailLoginModal/EmailLoginModal.types'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { WalletErrorModal } from '../../WalletErrorModal'
import { ConfirmingLogin } from './ConfirmingLogin'
import {
  connectToProvider,
  connectToSocialProvider,
  fromConnectionOptionToProviderType,
  getSignInOptionsMode,
  isMagicTestMode,
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
  const { redirect, redirectTo, skipSetup } = usePostLoginRedirect()
  const { initialized: flagInitialized, flags, variants } = useContext(FeatureFlagsContext)

  const signInOptionsMode = getSignInOptionsMode(variants)

  // Wallet error modal state (shown when redirected from AutoLoginRedirect after MM rejection)
  const [showWalletErrorModal, setShowWalletErrorModal] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('walletError') === 'rejected'
  })

  // Email login state
  const [currentEmail, setCurrentEmail] = useState('')
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showConfirmingLogin, setShowConfirmingLogin] = useState(false)
  const [confirmingLoginError, setConfirmingLoginError] = useState<string | null>(null)
  // Monotonic token identifying the current connect attempt. Each handleOnConnect captures the
  // value it bumped this ref to and, after every await, bails if the ref has since moved — because
  // the user closed the modal (which bumps it) or started another attempt. A per-attempt token,
  // rather than a shared boolean, is required: a boolean set on close would be reset to false by the
  // next attempt, letting a still-pending earlier attempt resume and redirect behind the user's back.
  const connectAttemptRef = useRef(0)
  // The last verified email-login result. If a post-verification step (identity, profile) fails,
  // the OTP code is already consumed, so retrying must re-run those steps with this result rather
  // than reopening the OTP modal (where the spent code would fail and the resend cooldown resets).
  const lastEmailLoginResultRef = useRef<EmailLoginResult | null>(null)

  // TODO: remove /play from redirectTo. Build guest URL only when redirect path includes /play; use its presence to show the option.
  const guestRedirectToURL = useMemo(() => {
    if (!redirectTo) return ''
    try {
      const url = redirectTo.startsWith('/') ? new URL(redirectTo, window.location.origin) : new URL(redirectTo)
      if (!url.pathname.includes('/play')) return ''
      // Use set, not append: if redirectTo already carries a guest param, appending would produce
      // `guest=false&guest=true` and a consumer reading the first value would not enter guest mode.
      url.searchParams.set('guest', 'true')
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

  const handleGuestLogin = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Modified clicks (open in new tab/window) keep this page alive, so the event flushes on its
      // own — fire it and let the browser handle navigation.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        void trackGuestLogin()
        return
      }
      // Normal click: block the anchor's immediate navigation so the guest-login event has time to
      // flush to Segment (trackGuestLogin waits TRACKING_DELAY), then navigate ourselves. Navigate
      // even if tracking rejects so the user is never stranded.
      event.preventDefault()
      void trackGuestLogin().finally(() => {
        window.location.href = guestRedirectToURL
      })
    },
    [trackGuestLogin, guestRedirectToURL]
  )

  const getReferrerFromCurrentSearch = useCallback(() => {
    const search = new URLSearchParams(window.location.search)
    return extractReferrerFromSearchParameters(search)
  }, [])

  const runProfileRedirect = useCallback(
    async (account: string, referrer: string | null, providedIdentity: AuthIdentity | null = null, onRedirect?: () => void) => {
      if (!skipSetup && account) {
        const userIdentity = providedIdentity ?? identity
        const profile = await ensureProfile(account, userIdentity, { redirectTo, referrer })
        if (!profile) return
      }

      markReturningUser(account)
      redirect()
      onRedirect?.()
    },
    [skipSetup, redirectTo, identity, ensureProfile, redirect]
  )

  const checkClockSynchronization = useCallback(async (): Promise<boolean> => {
    const isSync = await checkClockSync()
    if (!isSync) {
      setShowConnectionLayout(false)
      setShowClockSyncModal(true)
      return false
    }
    return true
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
      // Start a new attempt and capture its token. Any earlier in-flight attempt now has a stale
      // token and will bail at its next checkpoint instead of resuming.
      const attemptId = ++connectAttemptRef.current

      trackLoginClick({
        method: connectionType,
        type: providerType
      })

      try {
        if (isLoggingInThroughSocial) {
          // CP2 reached is tracked from CallbackPage after the OAuth redirect returns
          // (at this point we don't have the user's email or wallet yet).
          // Show the connection layout so that if connectToSocialProvider throws, the
          // catch's ERROR state is visible and recoverable instead of leaving the page
          // silently disabled with currentConnectionType still set.
          setShowConnectionLayout(true)
          setLoadingState(ConnectionLayoutState.LOADING_MAGIC)
          await connectToSocialProvider(connectionType, isMagicTestMode(flags[FeatureFlagsKeys.MAGIC_TEST]), redirectTo)
        } else {
          if (requiresInjectedProvider(connectionType) && !window.ethereum) {
            throw new Error('No wallet extension detected. Please install MetaMask or another Ethereum wallet.')
          }
          setShowConnectionLayout(true)
          setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)
          if (connectAttemptRef.current !== attemptId) return

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
          if (connectAttemptRef.current !== attemptId) return

          // Clear any stored social login emails since this is a wallet login
          localStorage.removeItem('dcl_thirdweb_user_email')
          localStorage.removeItem('dcl_magic_user_email')

          await trackLoginSuccess({
            ethAddress: connectionData.account ?? undefined,
            type: providerType
          })

          const referrer = getReferrerFromCurrentSearch()

          const isClockSync = await checkClockSynchronization()
          if (connectAttemptRef.current !== attemptId) return

          if (isClockSync) {
            await runProfileRedirect(connectionData.account ?? '', referrer, freshIdentity, () => setShowConnectionLayout(false))
          }
        }
      } catch (error) {
        if (connectAttemptRef.current !== attemptId) return
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
    // Invalidate the in-flight attempt so a signature the user approves after dismissing the modal
    // can't redirect or push them into setup. Bumping the token (rather than setting a boolean)
    // ensures a subsequent attempt can't accidentally un-cancel this one.
    connectAttemptRef.current += 1
    setShowConnectionLayout(false)
    setCurrentConnectionType(undefined)
    setLoadingState(ConnectionLayoutState.CONNECTING_WALLET)
  }, [setShowConnectionLayout])

  const handleWalletErrorClose = useCallback(() => {
    setShowWalletErrorModal(false)
    const params = new URLSearchParams(window.location.search)
    params.delete('walletError')
    const query = params.toString()
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [])

  const handleWalletErrorTryAgain = useCallback(() => {
    setShowWalletErrorModal(false)
    const params = new URLSearchParams(window.location.search)
    params.delete('walletError')
    const query = params.toString()
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState({}, '', newUrl)
    handleOnConnect(ConnectionOptionType.METAMASK)
  }, [handleOnConnect])

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
      // Remember the verified result so a retry after a post-verification failure can resume from
      // here instead of asking for the (already consumed) OTP code again.
      lastEmailLoginResultRef.current = result
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

  const handleConfirmingLoginRetry = useCallback(() => {
    setConfirmingLoginError(null)
    // The failure happened after the OTP was verified, so the wallet is already connected — re-run
    // the post-verification steps with the stored result. Only fall back to the OTP modal if we
    // somehow have no result to resume from.
    if (lastEmailLoginResultRef.current) {
      handleEmailLoginSuccess(lastEmailLoginResultRef.current)
    } else {
      setShowConfirmingLogin(false)
      setShowEmailLoginModal(true)
    }
  }, [handleEmailLoginSuccess])

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

    if (!currentConnectionType) return

    const referrer = getReferrerFromCurrentSearch()

    if (requiresInjectedProvider(currentConnectionType) && !window.ethereum) {
      handleError(new Error('No wallet extension detected'), 'Wallet extension not available for clock sync continue')
      return
    }

    try {
      // Reuse the connection established moments ago instead of reconnecting. connectToProvider
      // clears WalletConnect storage, which would tear down the active pairing and force a fresh QR
      // scan (and could bind a different account) just to acknowledge the clock-drift warning.
      const connectionData = await getCurrentConnectionData()
      if (!connectionData?.account) {
        throw new Error('No active connection found for clock sync continue')
      }
      await runProfileRedirect(connectionData.account, referrer, connectionData.identity ?? null, () => setShowConnectionLayout(false))
    } catch (error) {
      handleError(error, 'Error during clock sync continue flow')
      // Surface a visible, recoverable error instead of leaving the page silently
      // disabled with currentConnectionType still set (mirrors the handleOnConnect catch).
      setLoadingState(ConnectionLayoutState.ERROR)
      setShowConnectionLayout(true)
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
      <WalletErrorModal open={showWalletErrorModal} onTryAgain={handleWalletErrorTryAgain} onClose={handleWalletErrorClose} />
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
