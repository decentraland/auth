import { useCallback, useContext, useEffect, useState } from 'react'
import ArrowBackIosNewTwoToneIcon from '@mui/icons-material/ArrowBackIosNewTwoTone'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { CircularProgress } from 'decentraland-ui2'
import wrongImg from '../../../assets/images/wrong.svg'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAuthFlow } from '../../../hooks/useAuthFlow'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { locations } from '../../../shared/locations'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionContainer, ConnectionTitle, DecentralandLogo, ProgressContainer } from '../../ConnectionModal/ConnectionLayout.styled'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'
import { ActionButton, Background, Description, Icon, Main, SuccessContainer, Title } from '../MobileAuthPage/MobileAuthPage.styled'
import { MobileAuthSuccess } from '../MobileAuthPage/MobileAuthSuccess'

export const MobileCallbackPage = () => {
  const navigate = useNavigateWithSearchParams()
  const { initialized, flags } = useContext(FeatureFlagsContext)
  const { connectToMagic } = useAuthFlow()
  const [targetConfig] = useTargetConfig()

  const [isProcessing, setIsProcessing] = useState(false)
  const [identityId, setIdentityId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const processOAuthCallback = useCallback(async () => {
    try {
      // Get OAuth result from Magic
      const magic = await createMagicInstance(!!flags[FeatureFlagsKeys.MAGIC_TEST])
      await magic?.oauth2.getRedirectResult()
      // Connect to Magic provider
      const connectionData = await connectToMagic()
      if (!connectionData?.account || !connectionData?.provider) {
        throw new Error('Failed to connect to Magic')
      }

      // Generate identity
      await getIdentitySignature(connectionData.account.toLowerCase(), connectionData.provider)

      // Get the identity from localStorage
      const identity = localStorageGetIdentity(connectionData.account.toLowerCase())
      if (!identity) {
        throw new Error('Failed to get identity')
      }

      // Post identity to server
      const httpClient = createAuthServerHttpClient()
      const response = await httpClient.postIdentity(identity, { isMobile: true })

      setIdentityId(response.identityId)
    } catch (err) {
      handleError(err, 'Mobile OAuth callback error', {
        sentryTags: {
          isMobileFlow: true
        }
      })
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }, [flags, connectToMagic])

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
