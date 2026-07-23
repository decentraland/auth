import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Provider } from 'decentraland-connect'
import { Button, CircularProgress, muiIcons } from 'decentraland-ui2'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { ConnectionType } from '../../../modules/analytics/types'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { ONE_MONTH_IN_MINUTES, getIdentitySignature } from '../../../shared/connection/identity'
import { isMagicRpcError } from '../../../shared/errors'
import { getConnectionOptionFromState } from '../../../shared/oauthState'
import { handleError } from '../../../shared/utils/errorHandler'
import { OAUTH_ACCESS_DENIED_ERROR, createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { ActionButton, Background, Description, Icon, Main, SuccessContainer, Title } from '../MobileAuthPage/MobileAuthPage.styled'
import { MobileAuthSuccess } from '../MobileAuthPage/MobileAuthSuccess'

const ArrowBackIosNewTwoToneIcon = muiIcons.ArrowBackIosNewTwoTone

export const MobileCallbackPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigateWithSearchParams()
  const { initialized, flags } = useContext(FeatureFlagsContext)
  const isMagicTest = !!flags[FeatureFlagsKeys.MAGIC_TEST]
  const [targetConfig] = useTargetConfig()
  const { trackLoginSuccess } = useAnalytics()

  const hasStartedProcessing = useRef(false)
  const [identityId, setIdentityId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Build the /mobile return path preserving the mobile session ids (`u`/`s`). connectToSocialProvider
  // reads them from the URL to correlate the partner app's analytics/Sentry; a bare locations.mobile()
  // would drop them and break correlation on the retried login.
  const buildMobileReturnPath = useCallback(() => {
    const current = new URLSearchParams(window.location.search)
    const preserved = new URLSearchParams()
    const userId = current.get('u')
    const sessionId = current.get('s')
    if (userId) preserved.set('u', userId)
    if (sessionId) preserved.set('s', sessionId)
    const query = preserved.toString()
    return `/mobile${query ? `?${query}` : ''}`
  }, [])

  const processOAuthCallback = useCallback(async () => {
    // Check for OAuth error in URL params before getRedirectResult() strips them
    const oauthError = new URLSearchParams(window.location.search).get('error')
    if (oauthError === OAUTH_ACCESS_DENIED_ERROR) {
      // User cancelled at the OAuth provider — not an error, go back to mobile login
      navigate(buildMobileReturnPath())
      return
    }

    // Capture before getRedirectResult() strips the `state` query param
    const oauthConnectionOption = getConnectionOptionFromState()

    try {
      const magic = await createMagicInstance(isMagicTest)
      await magic.oauth2.getRedirectResult()

      // Reuse the same Magic instance to avoid spawning a second iframe
      const provider = await magic.wallet.getProvider()
      const accounts: string[] = await provider.request({ method: 'eth_accounts' })
      const account = accounts[0]
      if (!account) throw new Error('Failed to get account from Magic')

      // Generate identity
      const ethAddress = account.toLowerCase()
      const identity = await getIdentitySignature(ethAddress, provider as unknown as Provider, ONE_MONTH_IN_MINUTES * 3)

      // Post identity to server
      const httpClient = createAuthServerHttpClient()
      const response = await httpClient.postIdentity(identity, { isMobile: true })

      await trackLoginSuccess({
        ethAddress,
        type: ConnectionType.WEB2,
        method: oauthConnectionOption
      })

      setIdentityId(response.identityId)
    } catch (err) {
      handleError(err, 'Mobile OAuth callback error', {
        sentryTags: {
          isMobileFlow: true
        },
        sentryExtra: {
          oauthError: oauthError ?? undefined,
          magicRpcCode: isMagicRpcError(err) ? String(err.code) : undefined,
          magicRpcRawMessage: isMagicRpcError(err) ? err.rawMessage : undefined,
          magicRpcData: isMagicRpcError(err) ? JSON.stringify(err.data) : undefined
        }
      })
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }, [isMagicTest, navigate, trackLoginSuccess, buildMobileReturnPath])

  useEffect(() => {
    if (!initialized || hasStartedProcessing.current) return
    hasStartedProcessing.current = true

    processOAuthCallback()
  }, [initialized, processOAuthCallback])

  const handleRetry = useCallback(() => {
    navigate(buildMobileReturnPath())
  }, [navigate, buildMobileReturnPath])

  // Show error state
  if (error) {
    return (
      <Main component="main">
        <Background />
        <SuccessContainer>
          <Icon src={wrongImg} alt="Error" />
          <Title>{t('login_error.title')}</Title>
          <Description>{error}</Description>
          <ActionButton>
            <Button variant="contained" onClick={handleRetry} startIcon={<ArrowBackIosNewTwoToneIcon fontSize="small" />}>
              {t('common.try_again')}
            </Button>
          </ActionButton>
        </SuccessContainer>
      </Main>
    )
  }

  // Show success screen - use shared MobileAuthSuccess component
  if (identityId) {
    return <MobileAuthSuccess identityId={identityId} explorerText={targetConfig.explorerText} onTryAgain={handleRetry} />
  }

  // Show loading state
  return (
    <Main component="main">
      <ConnectionContainer>
        <DecentralandLogo size="huge" />
        <ConnectionTitle>{t('connection_layout.validating_sign_in')}</ConnectionTitle>
        <ProgressContainer>
          <CircularProgress color="inherit" />
        </ProgressContainer>
      </ConnectionContainer>
    </Main>
  )
}
