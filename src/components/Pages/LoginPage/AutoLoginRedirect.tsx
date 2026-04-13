import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Env } from '@dcl/ui-env'
import { Button, CircularProgress } from 'decentraland-ui2'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { ConnectionType } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { useCurrentConnectionData } from '../../../shared/connection'
import { locations } from '../../../shared/locations'
import { markReturningUser } from '../../../shared/onboarding/markReturningUser'
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
  const { redirect } = useAfterLoginRedirection()
  const { ensureProfile } = useEnsureProfile()

  const redirectTo = new URLSearchParams(window.location.search).get('redirectTo') ?? undefined
  const hasStarted = useRef(false)
  const [phase, setPhase] = useState<Phase>('redirecting')

  const isMagicTest = config.is(Env.DEVELOPMENT)
  const isSocial = isSocialLogin(connectionType)
  const providerName = connectionOptionTitles[connectionType]

  const handleCancel = useCallback(() => {
    // Navigate to login page without loginMethod — shows full login UI
    // Preserve redirectTo so the user can complete the flow with another method
    const params = new URLSearchParams()
    if (redirectTo) params.set('redirectTo', redirectTo)
    const targetConfigId = new URLSearchParams(window.location.search).get('targetConfigId')
    if (targetConfigId) params.set('targetConfigId', targetConfigId)
    const query = params.toString()
    window.location.href = `${locations.login()}${query ? `?${query}` : ''}`
  }, [redirectTo])

  const startLogin = useCallback(async () => {
    const connectionTypeForTracking = isSocial ? ConnectionType.WEB2 : ConnectionType.WEB3

    try {
      trackLoginClick({ method: connectionType, type: connectionTypeForTracking })

      if (isSocial) {
        // Social (Magic OAuth) — redirect to provider, CallbackPage handles the rest
        await connectToSocialProvider(connectionType, isMagicTest, redirectTo)
        // If we get here, the browser should be redirecting to Google/Discord/etc.
        return
      }

      // Wallet (MetaMask/injected) — connect directly, no redirect needed
      if (!window.ethereum) {
        throw new Error('No wallet extension detected. Please install MetaMask or another Ethereum wallet.')
      }

      const connectionData = await connectToProvider(connectionType)

      // MetaMask connected — now verify and redirect
      setPhase('verifying')

      await getIdentitySignature(connectionData)

      await trackLoginSuccess({
        ethAddress: connectionData.account ?? undefined,
        type: connectionTypeForTracking
      })

      markReturningUser(connectionData.account ?? '')
      redirect()
    } catch (error) {
      handleError(error, `Error during auto-login (${connectionType})`)
      setPhase('failed')
    }
  }, [connectionType, isSocial, isMagicTest, redirectTo, trackLoginClick, trackLoginSuccess, getIdentitySignature, redirect, ensureProfile])

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
    if (phase === 'verifying') {
      return isSocial
        ? t('auto_login.verifying_credentials')
        : t('auto_login.confirming_login')
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
          <Button
            variant="text"
            onClick={handleCancel}
            sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', marginTop: 2 }}
          >
            {t('auto_login.cancel')}
          </Button>
        </ConnectionContainer>
      </Wrapper>
    </Container>
  )
}
