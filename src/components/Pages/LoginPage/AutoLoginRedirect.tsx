import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress } from 'decentraland-ui2'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { usePostLoginRedirect } from '../../../hooks/usePostLoginRedirect'
import { ConnectionType } from '../../../modules/analytics/types'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isUserRejectedTransaction } from '../../../shared/errors'
import { locations } from '../../../shared/locations'
import { markReturningUser } from '../../../shared/onboarding/markReturningUser'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { checkClockSync } from '../../../shared/utils/clockSync'
import { handleError } from '../../../shared/utils/errorHandler'
import { AnimatedBackground } from '../../AnimatedBackground'
import { ConnectionOptionType, connectionOptionTitles } from '../../Connection/Connection.types'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { Container, Wrapper } from '../../Pages/CallbackPage/CallbackPage.styled'
import { LoginErrorPage } from '../../Pages/LoginErrorPage'
import { connectToProvider, connectToSocialProvider, isMagicTestMode, isSocialLogin } from './utils'

type Props = {
  connectionType: ConnectionOptionType
}

type Phase = 'redirecting' | 'verifying' | 'error'

export const AutoLoginRedirect = ({ connectionType }: Props) => {
  const { t } = useTranslation()
  const { trackLoginClick, trackLoginSuccess } = useAnalytics()
  const { getIdentitySignature } = useCurrentConnectionData()
  const { redirect, redirectTo, skipSetup } = usePostLoginRedirect()
  const { ensureProfile } = useEnsureProfile()
  const navigate = useNavigate()

  const hasStarted = useRef(false)
  // Set when the user cancels. startLogin checks it after each await so a wallet prompt the user
  // approves after cancelling can't resurrect the flow (request a signature, redirect, or push the
  // user into setup) behind their back.
  const cancelledRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('redirecting')
  // Use a ref for skipSetup so the startLogin callback always reads the latest value.
  // The callback fires once via useEffect, but skipSetup may change after FF loads.
  const skipSetupRef = useRef(skipSetup)
  skipSetupRef.current = skipSetup

  // Resolve Magic test-mode from the feature flag, exactly as CallbackPage does. Both halves of the
  // OAuth round-trip MUST agree on the Magic key; if this used only the env fallback while the flag
  // was set (e.g. dapps-magic-dev-test enabled in prod), the callback would instantiate a different
  // Magic instance and getRedirectResult would fail. startLogin is gated on `initialized` below so
  // the flag value is loaded before the redirect starts.
  const { flags, initialized } = useContext(FeatureFlagsContext)
  const isMagicTest = isMagicTestMode(flags[FeatureFlagsKeys.MAGIC_TEST])
  const isSocial = isSocialLogin(connectionType)
  const providerName = connectionOptionTitles[connectionType]

  // Raw redirectTo for connectToSocialProvider (needs the original, unsanitized value
  // because Magic encodes it in customData for the OAuth callback round-trip)
  const rawRedirectTo = useMemo(() => new URLSearchParams(window.location.search).get('redirectTo') ?? undefined, [])

  const handleCancel = useCallback(() => {
    // Mark the flow cancelled so any in-flight startLogin continuation bails out at its next
    // checkpoint instead of redirecting or prompting after the user has moved on.
    cancelledRef.current = true
    // Navigate to login page without loginMethod — shows full login UI.
    // Uses navigate() to respect the basename (/auth).
    const params = new URLSearchParams(window.location.search)
    params.delete('loginMethod')
    navigate(locations.login({ queryParams: params }), { replace: true })
  }, [navigate])

  const startLogin = useCallback(async () => {
    const connectionTypeForTracking = isSocial ? ConnectionType.WEB2 : ConnectionType.WEB3

    try {
      trackLoginClick({ method: connectionType, type: connectionTypeForTracking })

      if (isSocial) {
        // Social (Magic OAuth) — redirect to provider, CallbackPage handles the rest
        await connectToSocialProvider(connectionType, isMagicTest, rawRedirectTo)
        // If we get here, the browser should be redirecting to Google/Discord/etc.
        return
      }

      // Wallet (MetaMask/injected) — connect directly, no redirect needed.
      // If no injected provider is available we can't auto-login, so route the
      // user to the full login page where the wallet button is disabled and
      // they can pick another method instead of seeing a hard error screen.
      if (!window.ethereum) {
        handleCancel()
        return
      }

      const connectionData = await connectToProvider(connectionType)
      if (cancelledRef.current) return
      const ethAddress = connectionData.account?.toLowerCase() ?? ''

      // MetaMask connected — now verify and redirect
      setPhase('verifying')

      // Track CP2 reached after wallet connects (matches LoginPage behavior)
      trackCheckpoint({
        checkpointId: 2,
        action: 'reached',
        source: 'auth',
        userIdentifier: ethAddress,
        identifierType: 'wallet',
        wallet: ethAddress,
        metadata: { loginMethod: connectionType }
      })

      const freshIdentity = await getIdentitySignature(connectionData)
      if (cancelledRef.current) return

      // Clear stale social login emails since this is a wallet login
      localStorage.removeItem('dcl_thirdweb_user_email')
      localStorage.removeItem('dcl_magic_user_email')

      await trackLoginSuccess({
        ethAddress: connectionData.account ?? undefined,
        type: connectionTypeForTracking
      })

      // Check clock sync — if drift is too large, fall back to full LoginPage
      // which has the ClockSyncModal UI
      if (!(await checkClockSync())) {
        handleCancel()
        return
      }

      // Ensure profile exists for new users (avatar/name setup).
      // Skip ensureProfile entirely for Explorer flows (redirectTo points to /auth/requests/).
      // The RequestPage handles profile checking and auto-sign for those flows.
      // For web flows, ensureProfile navigates to QuickSetup if the user has no profile.
      // Match on the URL pathname (not a substring): a redirectTo like /play?next=/auth/requests/x
      // must NOT be treated as an Explorer flow, or a new web user would skip setup entirely.
      let isExplorerRedirect = false
      if (rawRedirectTo) {
        try {
          const redirectUrl = rawRedirectTo.startsWith('/') ? new URL(rawRedirectTo, window.location.origin) : new URL(rawRedirectTo)
          isExplorerRedirect = redirectUrl.hostname === window.location.hostname && redirectUrl.pathname.startsWith('/auth/requests/')
        } catch {
          // Malformed URL — treat as a non-Explorer (web) redirect.
        }
      }
      if (!isExplorerRedirect && !skipSetupRef.current && connectionData.account) {
        const profile = await ensureProfile(connectionData.account, freshIdentity, {
          redirectTo,
          referrer: null,
          navigateOptions: { replace: true }
        })
        if (cancelledRef.current || !profile) return
      }

      if (cancelledRef.current) return
      markReturningUser(connectionData.account ?? '')
      redirect()
    } catch (error) {
      if (cancelledRef.current) return
      if (isUserRejectedTransaction(error)) {
        // User cancelled the signature in wallet — navigate to login with walletError param
        // so LoginPage can show the WalletErrorModal. Uses navigate() to respect basename.
        const params = new URLSearchParams(window.location.search)
        params.delete('loginMethod')
        params.set('walletError', 'rejected')
        navigate(locations.login({ queryParams: params }), { replace: true })
        return
      }
      handleError(error, `Error during auto-login (${connectionType})`)
      setPhase('error')
    }
  }, [
    connectionType,
    isSocial,
    isMagicTest,
    rawRedirectTo,
    redirectTo,
    trackLoginClick,
    trackLoginSuccess,
    getIdentitySignature,
    redirect,
    ensureProfile,
    skipSetup,
    handleCancel
  ])

  useEffect(() => {
    // Wait for feature flags so the Magic key matches the one CallbackPage will use. `initialized`
    // is fail-open (it flips true even when the flag fetch errors or times out), so this can only
    // delay auto-login, never block it.
    if (!initialized || hasStarted.current) return
    hasStarted.current = true
    startLogin()
  }, [initialized, startLogin])

  const handleErrorTryAgain = useCallback(() => {
    setPhase('redirecting')
    // Keep hasStarted true so the mount effect can't fire a second concurrent
    // startLogin() if startLogin's identity deps change (e.g. a feature-flag poll
    // flips skipSetup). We invoke startLogin() directly here for the retry.
    hasStarted.current = true
    startLogin()
  }, [startLogin])

  if (phase === 'error') {
    return <LoginErrorPage onTryAgain={handleErrorTryAgain} />
  }

  const statusMessage = (() => {
    if (phase === 'verifying') {
      return isSocial ? t('auto_login.verifying_credentials') : t('auto_login.confirming_login')
    }
    return t('auto_login.redirecting_to', { provider: providerName })
  })()

  return (
    <Container>
      <AnimatedBackground variant="absolute" />
      <Wrapper>
        <ConnectionContainer>
          <DecentralandLogo size="huge" />
          <ConnectionTitle>{statusMessage}</ConnectionTitle>
          <ProgressContainer>
            <CircularProgress color="inherit" />
          </ProgressContainer>
          <Button variant="text" onClick={handleCancel} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', marginTop: 2 }}>
            {t('auto_login.cancel')}
          </Button>
        </ConnectionContainer>
      </Wrapper>
    </Container>
  )
}
