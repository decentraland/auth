import { useCallback, useContext, useEffect, useState } from 'react'
import ArrowBackIosNewTwoToneIcon from '@mui/icons-material/ArrowBackIosNewTwoTone'
import { RPCError } from 'magic-sdk'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Provider } from 'decentraland-connect'
import { CircularProgress } from 'decentraland-ui2'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { locations } from '../../../shared/locations'
import { restoreSessionStorageMirror } from '../../../shared/mobile'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance, OAUTH_ACCESS_DENIED_ERROR } from '../../../shared/utils/magicSdk'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'
import { ActionButton, Background, Description, Icon, Main, SuccessContainer, Title } from '../MobileAuthPage/MobileAuthPage.styled'
import { MobileAuthSuccess } from '../MobileAuthPage/MobileAuthSuccess'

export const MobileCallbackPage = () => {
  const navigate = useNavigateWithSearchParams()
  const { initialized, flags } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

  const [isProcessing, setIsProcessing] = useState(false)
  const [identityId, setIdentityId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processOAuthCallback = useCallback(async () => {
    // Check for OAuth error in URL params before getRedirectResult() strips them
    const oauthError = new URLSearchParams(window.location.search).get('error')
    if (oauthError === OAUTH_ACCESS_DENIED_ERROR) {
      // User cancelled at the OAuth provider — not an error, go back to mobile login
      navigate(locations.mobile())
      return
    }

    try {
      // Restore sessionStorage if Mobile Safari evicted it during the OAuth redirect.
      // This recovers the PKCE code verifier that Magic needs.
      console.log(
        '[MobileCallback] Before restore — sessionStorage.length:',
        sessionStorage.length,
        'has PKCE:',
        sessionStorage.getItem('magic_oauth_pkce_verifier') !== null
      )
      const restored = restoreSessionStorageMirror()
      console.log(
        '[MobileCallback] After restore — restored:',
        restored,
        'has PKCE:',
        sessionStorage.getItem('magic_oauth_pkce_verifier') !== null
      )

      // Use a single Magic instance for the entire flow to avoid the two-iframe
      // split that caused "user isn't logged in" errors.
      const magic = await createMagicInstance(!!flags[FeatureFlagsKeys.MAGIC_TEST])
      await magic.oauth2.getRedirectResult()
      console.log('[MobileCallback] getRedirectResult succeeded')

      // Reuse the same Magic instance to avoid spawning a second iframe
      const provider = await magic.wallet.getProvider()
      const accounts: string[] = await provider.request({ method: 'eth_accounts' })
      const account = accounts[0]
      if (!account) throw new Error('Failed to get account from Magic')

      // Generate identity
      const identity = await getIdentitySignature(account.toLowerCase(), provider as unknown as Provider)

      // Post identity to server
      const httpClient = createAuthServerHttpClient()
      const response = await httpClient.postIdentity(identity, { isMobile: true })

      setIdentityId(response.identityId)
    } catch (err) {
      handleError(err, 'Mobile OAuth callback error', {
        sentryTags: {
          isMobileFlow: true
        },
        sentryExtra: {
          oauthError: oauthError ?? undefined,
          magicRpcCode: err instanceof RPCError ? String(err.code) : undefined,
          magicRpcRawMessage: err instanceof RPCError ? err.rawMessage : undefined,
          magicRpcData: err instanceof RPCError ? JSON.stringify(err.data) : undefined
        }
      })
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }, [flags, navigate])

  useEffect(() => {
    if (!initialized || isProcessing) return

    setIsProcessing(true)
    processOAuthCallback()
  }, [initialized, isProcessing, processOAuthCallback])

  const handleRetry = useCallback(() => {
    navigate(locations.mobile())
  }, [navigate])

  // Show error state
  if (error) {
    return (
      <Main component="main">
        <Background />
        <SuccessContainer>
          <Icon src={wrongImg} alt="Error" />
          <Title>Authentication Failed</Title>
          <Description>{error}</Description>
          <ActionButton>
            <Button primary onClick={handleRetry}>
              <ArrowBackIosNewTwoToneIcon fontSize="small" />
              Try again
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
        <ConnectionTitle>Just a moment, we're verifying your login credentials...</ConnectionTitle>
        <ProgressContainer>
          <CircularProgress color="inherit" />
        </ProgressContainer>
      </ConnectionContainer>
    </Main>
  )
}
