import { useCallback, useContext, useEffect, useState } from 'react'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { ProviderType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAuthFlow } from '../../../hooks/useAuthFlow'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { locations } from '../../../shared/locations'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionLayout } from '../../ConnectionModal/ConnectionLayout'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'
import { launchDeepLink } from '../RequestPage/utils'
import styles from './MobileCallbackPage.module.css'

const COUNTDOWN_SECONDS = 5

export const MobileCallbackPage = () => {
  const navigate = useNavigateWithSearchParams()
  const { initialized, flags } = useContext(FeatureFlagsContext)
  const { connectToMagic } = useAuthFlow()
  const [targetConfig] = useTargetConfig()

  const [isProcessing, setIsProcessing] = useState(false)
  const [identityId, setIdentityId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [deepLinkFailed, setDeepLinkFailed] = useState(false)

  const deepLinkUrl = identityId ? `decentraland://open?signin=${identityId}` : ''

  const processOAuthCallback = useCallback(async () => {
    try {
      // Get OAuth result from Magic
      const magic = await createMagicInstance(!!flags[FeatureFlagsKeys.MAGIC_TEST])
      const result = await magic?.oauth2.getRedirectResult()

      // Store email if available
      if (result?.oauth?.userInfo?.email) {
        localStorage.setItem('dcl_magic_user_email', result.oauth.userInfo.email)
      }

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
      const response = await httpClient.postIdentity(identity)

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

  // Countdown and auto-launch deep link on success
  useEffect(() => {
    if (!identityId || deepLinkFailed) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          attemptDeepLink()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [identityId, deepLinkFailed])

  const attemptDeepLink = useCallback(async () => {
    if (!deepLinkUrl) return

    const wasLaunched = await launchDeepLink(deepLinkUrl)
    if (!wasLaunched) {
      setDeepLinkFailed(true)
    }
  }, [deepLinkUrl])

  const handleRetry = useCallback(() => {
    // Redirect back to mobile auth page on error
    navigate(locations.mobile())
  }, [navigate])

  // Show error state
  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.errorLogo}></div>
          <div className={styles.title}>Authentication Failed</div>
          <div className={styles.description}>{error}</div>
          <Button primary onClick={handleRetry} style={{ marginTop: '24px' }}>
            <Icon name="arrow left" />
            Try again
          </Button>
        </div>
      </main>
    )
  }

  // Show success screen with deep link
  if (identityId) {
    if (deepLinkFailed) {
      return (
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.errorLogo}></div>
            <div className={styles.title}>Could not open {targetConfig.explorerText}</div>
            <div className={styles.description}>
              The application could not be launched. Please make sure {targetConfig.explorerText} is installed and try again.
            </div>
            <Button primary onClick={handleRetry} style={{ marginTop: '24px' }}>
              <Icon name="arrow left" />
              Try again
            </Button>
          </div>
        </main>
      )
    }

    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.logo}></div>
          <div className={styles.title}>Sign In Successful</div>
          <div className={styles.description}>
            You will be redirected to {targetConfig.explorerText} in {countdown}...
          </div>
          <Button primary onClick={attemptDeepLink} style={{ marginTop: '24px' }}>
            <Icon name="sign in" />
            Return to {targetConfig.explorerText}
          </Button>
        </div>
      </main>
    )
  }

  // Show loading state
  return (
    <main className={styles.main}>
      <div className={styles.wrapper}>
        <ConnectionLayout
          state={ConnectionLayoutState.VALIDATING_SIGN_IN}
          providerType={flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC}
          onTryAgain={handleRetry}
        />
      </div>
    </main>
  )
}
