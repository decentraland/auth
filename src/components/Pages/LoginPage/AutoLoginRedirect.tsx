import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Env } from '@dcl/ui-env'
import { Button, CircularProgress } from 'decentraland-ui2'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { ConnectionType } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isUserRejectedTransaction } from '../../../shared/errors'
import { locations } from '../../../shared/locations'
import { markReturningUser } from '../../../shared/onboarding/markReturningUser'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { handleError } from '../../../shared/utils/errorHandler'
import { AnimatedBackground } from '../../AnimatedBackground'
import { ConnectionOptionType, connectionOptionTitles } from '../../Connection/Connection.types'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { Container, Wrapper } from '../../Pages/CallbackPage/CallbackPage.styled'
import { connectToProvider, connectToSocialProvider, isSocialLogin } from './utils'

type Props = {
  connectionType: ConnectionOptionType
}

type Phase = 'redirecting' | 'verifying' | 'failed'

export const AutoLoginRedirect = ({ connectionType }: Props) => {
  const { t } = useTranslation()
  const { trackLoginClick, trackLoginSuccess } = useAnalytics()
  const { getIdentitySignature } = useCurrentConnectionData()
  const { redirect, url: redirectTo } = useAfterLoginRedirection()
  const [targetConfig] = useTargetConfig()
  const { ensureProfile } = useEnsureProfile()

  const hasStarted = useRef(false)
  const [phase, setPhase] = useState<Phase>('redirecting')

  // Use env-only check for Magic test mode. This fires before feature flags
  // load, so we use config.is() directly. CallbackPage uses
  // flags[MAGIC_TEST] ?? config.is(Env.DEVELOPMENT) — the ?? fallback
  // guarantees both resolve to the same value when flags haven't loaded yet.
  const isMagicTest = config.is(Env.DEVELOPMENT)
  const isSocial = isSocialLogin(connectionType)
  const providerName = connectionOptionTitles[connectionType]

  // Raw redirectTo for connectToSocialProvider (needs the original, unsanitized value
  // because Magic encodes it in customData for the OAuth callback round-trip)
  const rawRedirectTo = useMemo(() => new URLSearchParams(window.location.search).get('redirectTo') ?? undefined, [])

  const handleCancel = useCallback(() => {
    // Navigate to login page without loginMethod — shows full login UI.
    // useAfterLoginRedirection already preserves redirectTo + targetConfigId + flow,
    // so we just need to strip loginMethod and go to the login route.
    const params = new URLSearchParams(window.location.search)
    params.delete('loginMethod')
    const query = params.toString()
    window.location.href = `${locations.login()}${query ? `?${query}` : ''}`
  }, [])

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

      // Ensure profile exists for new users (avatar/name setup)
      if (targetConfig && !targetConfig.skipSetup && connectionData.account) {
        const profile = await ensureProfile(connectionData.account, freshIdentity, { redirectTo, navigateOptions: { replace: true } })
        if (!profile) return
      }

      markReturningUser(connectionData.account ?? '')
      redirect()
    } catch (error) {
      if (isUserRejectedTransaction(error)) {
        // User cancelled the signature in wallet — not an error, go to full login
        handleCancel()
        return
      }
      handleError(error, `Error during auto-login (${connectionType})`)
      setPhase('failed')
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
    targetConfig?.skipSetup,
    handleCancel
  ])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    startLogin()
  }, [startLogin])

  useEffect(() => {
    if (phase === 'failed') {
      // Small delay so the user sees the error state before navigating
      const timer = setTimeout(handleCancel, 2000)
      return () => clearTimeout(timer)
    }
  }, [phase, handleCancel])

  const statusMessage = (() => {
    if (phase === 'failed') {
      return t('auto_login.redirecting_to', { provider: providerName })
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
