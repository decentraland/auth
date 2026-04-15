import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Container, Wrapper } from '../../Pages/CallbackPage/CallbackPage.styled'
import { LoginErrorPage } from '../../Pages/LoginErrorPage'
import { connectToProvider, connectToSocialProvider, isMagicTestMode, isSocialLogin } from './utils'

type Props = {
  connectionType: ConnectionOptionType
}

type Phase = 'redirecting' | 'verifying' | 'failed' | 'error'

export const AutoLoginRedirect = ({ connectionType }: Props) => {
  const { t } = useTranslation()
  const { trackLoginClick, trackLoginSuccess } = useAnalytics()
  const { getIdentitySignature } = useCurrentConnectionData()
  const { redirect, redirectTo, skipSetup } = usePostLoginRedirect()
  const { ensureProfile } = useEnsureProfile()
  const navigate = useNavigate()

  const hasStarted = useRef(false)
  const [phase, setPhase] = useState<Phase>('redirecting')
  // Use a ref for skipSetup so the startLogin callback always reads the latest value.
  // The callback fires once via useEffect, but skipSetup may change after FF loads.
  const skipSetupRef = useRef(skipSetup)
  skipSetupRef.current = skipSetup

  // No feature flag available here (fires before flags load), so pass undefined.
  // isMagicTestMode falls back to config.is(Env.DEVELOPMENT).
  const isMagicTest = isMagicTestMode()
  const isSocial = isSocialLogin(connectionType)
  const providerName = connectionOptionTitles[connectionType]

  // Raw redirectTo for connectToSocialProvider (needs the original, unsanitized value
  // because Magic encodes it in customData for the OAuth callback round-trip)
  const rawRedirectTo = useMemo(() => new URLSearchParams(window.location.search).get('redirectTo') ?? undefined, [])

  const handleCancel = useCallback(() => {
    // Navigate to login page without loginMethod — shows full login UI.
    // Uses navigate() to respect the basename (/auth).
    const params = new URLSearchParams(window.location.search)
    params.delete('loginMethod')
    const query = params.toString()
    navigate(`${locations.login()}${query ? `?${query}` : ''}`, { replace: true })
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

      // Wallet (MetaMask/injected) — connect directly, no redirect needed
      if (!window.ethereum) {
        throw new Error('No wallet extension detected. Please install MetaMask or another Ethereum wallet.')
      }

      const connectionData = await connectToProvider(connectionType)
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

      // Ensure profile exists for new users (avatar/name setup)
      // Read from ref to get the latest value (FF may have loaded during the async flow)
      if (!skipSetupRef.current && connectionData.account) {
        const profile = await ensureProfile(connectionData.account, freshIdentity, {
          redirectTo,
          referrer: null,
          navigateOptions: { replace: true }
        })
        if (!profile) return
      }

      markReturningUser(connectionData.account ?? '')
      redirect()
    } catch (error) {
      if (isUserRejectedTransaction(error)) {
        // User cancelled the signature in wallet — navigate to login with walletError param
        // so LoginPage can show the WalletErrorModal. Uses navigate() to respect basename.
        const params = new URLSearchParams(window.location.search)
        params.delete('loginMethod')
        params.set('walletError', 'rejected')
        const query = params.toString()
        navigate(`${locations.login()}${query ? `?${query}` : ''}`, { replace: true })
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
    if (hasStarted.current) return
    hasStarted.current = true
    startLogin()
  }, [startLogin])

  const handleErrorTryAgain = useCallback(() => {
    setPhase('redirecting')
    hasStarted.current = false
    startLogin()
  }, [startLogin])

  if (phase === 'error') {
    return <LoginErrorPage onTryAgain={handleErrorTryAgain} />
  }

  const statusMessage = (() => {
    if (phase === 'failed') {
      return t('auto_login.error')
    }
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
