import { useCallback, useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { connection } from 'decentraland-connect'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useEnsureProfile } from '../../../hooks/useEnsureProfile'
import { ConnectionType } from '../../../modules/analytics/types'
import { useCurrentConnectionData } from '../../../shared/connection'
import { isMagicExtensionError, isMagicRpcError } from '../../../shared/errors'
import { extractReferrerFromSearchParameters, locations } from '../../../shared/locations'
import { isMobileSession } from '../../../shared/mobile'
import { markReturningUser } from '../../../shared/onboarding/markReturningUser'
import { getStoredEmail } from '../../../shared/onboarding/getStoredEmail'
import { trackCheckpoint } from '../../../shared/onboarding/trackCheckpoint'
import { handleError } from '../../../shared/utils/errorHandler'
import { OAUTH_ACCESS_DENIED_ERROR, createMagicInstance } from '../../../shared/utils/magicSdk'
import { AnimatedBackground } from '../../AnimatedBackground'
import { ConnectionLayout } from '../../ConnectionModal/ConnectionLayout'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { MobileCallbackPage } from '../MobileCallbackPage/MobileCallbackPage'
import { Container, Wrapper } from './CallbackPage.styled'

const CallbackPage = () => {
  // Render mobile callback UI directly if on mobile device
  if (isMobileSession()) {
    return <MobileCallbackPage />
  }

  return <DesktopCallbackPage />
}

const DesktopCallbackPage = () => {
  const { redirect, url: redirectTo } = useAfterLoginRedirection()
  const navigate = useNavigateWithSearchParams()
  const [searchParams] = useSearchParams()
  const [logInStarted, setLogInStarted] = useState(false)
  const [layoutState, setLayoutState] = useState(ConnectionLayoutState.VALIDATING_SIGN_IN)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const { initialized, flags } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()
  const { ensureProfile } = useEnsureProfile()
  const { trackLoginSuccess } = useAnalytics()
  const { getIdentitySignature } = useCurrentConnectionData()

  const connectAndGenerateSignature = useCallback(async () => {
    if (!initialized) {
      return undefined
    }

    const providerType = flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC
    const connectionData = await connection.connect(providerType)
    if (!connectionData) {
      return undefined
    }

    if (!connectionData.account) {
      throw new Error('No account returned from Magic connection')
    }

    if (connectionData.provider) {
      await getIdentitySignature(connectionData)
    }

    return connectionData
  }, [flags[FeatureFlagsKeys.MAGIC_TEST], initialized, getIdentitySignature])

  const handleContinue = useCallback(
    async (referrer: string | null) => {
      if (!initialized) {
        return
      }

      try {
        const connectionData = await connectAndGenerateSignature()
        if (!connectionData) {
          return
        }

        const ethAddress = connectionData.account?.toLowerCase() ?? ''

        // CP2 reached: social login callback — now we have account + email
        const storedEmail = getStoredEmail()
        trackCheckpoint({
          checkpointId: 2,
          action: 'reached',
          source: 'auth',
          userIdentifier: storedEmail || ethAddress,
          identifierType: storedEmail ? 'email' : 'wallet',
          email: storedEmail || undefined,
          wallet: ethAddress,
          metadata: { loginMethod: 'social' }
        })

        await trackLoginSuccess({
          ethAddress,
          type: ConnectionType.WEB2
        })

        const account = connectionData.account ?? ''

        if (targetConfig && !targetConfig.skipSetup && account) {
          // Get the freshly generated identity from localStorage for Magic flow
          const freshIdentity = localStorageGetIdentity(ethAddress)
          const profile = await ensureProfile(account, freshIdentity, { redirectTo, referrer, navigateOptions: { replace: true } })
          if (!profile) return
        }

        markReturningUser(account)
        redirect()
      } catch (error) {
        handleError(error, 'Error in callback continue flow')
        navigate(locations.login(), { replace: true })
      }
    },
    [navigate, connectAndGenerateSignature, redirect, trackLoginSuccess, initialized, targetConfig?.skipSetup, redirectTo, ensureProfile]
  )

  const logInAndRedirect = useCallback(async () => {
    // Check for OAuth error in URL params before getRedirectResult() strips them
    const oauthError = new URLSearchParams(window.location.search).get('error')

    if (oauthError === OAUTH_ACCESS_DENIED_ERROR) {
      // User cancelled at the OAuth provider — not an error, go back to login
      // Preserve the original redirectTo from the OAuth state so the next login attempt
      // still redirects to the correct destination (e.g., Marketplace)
      navigate(locations.login({ redirectTo }), { replace: true })
      return
    }

    try {
      const magic = await createMagicInstance(!!flags[FeatureFlagsKeys.MAGIC_TEST])
      const referrer = extractReferrerFromSearchParameters(searchParams)

      try {
        const result = await magic?.oauth2.getRedirectResult()

        // Store user email in localStorage if available
        if (result?.oauth?.userInfo?.email) {
          localStorage.setItem('dcl_magic_user_email', result.oauth.userInfo.email)
        }
      } catch (error) {
        // RPC -32600: "User is already logged in" — Magic skipped OAuth verification
        // because a session already exists. This is safe to ignore; proceed with the
        // existing session by calling handleContinue below.
        const isAlreadyLoggedIn = isMagicRpcError(error) && error.code === -32600
        if (!isAlreadyLoggedIn) {
          throw error
        }
      }

      await handleContinue(referrer)
    } catch (error) {
      // MISSING_PKCE_METADATA: the OAuth session was already consumed
      // (e.g. user navigated back to /callback). Not a real error — just redirect to login.
      const isExpiredOAuthSession = isMagicExtensionError(error) && error.code === 'MISSING_PKCE_METADATA'

      if (isExpiredOAuthSession) {
        navigate(locations.login({ redirectTo }), { replace: true })
        return
      }

      const errorMessage = handleError(error, 'Error logging in with Magic SDK', {
        skipTracking: false,
        sentryExtra: {
          oauthError: oauthError ?? undefined,
          magicRpcCode: isMagicRpcError(error) ? String(error.code) : undefined,
          magicRpcRawMessage: isMagicRpcError(error) ? error.rawMessage : undefined,
          magicRpcData: isMagicRpcError(error) ? JSON.stringify(error.data) : undefined
        }
      })

      setErrorDetail(errorMessage)
      setLayoutState(ConnectionLayoutState.ERROR_GENERIC)
    }
  }, [navigate, handleContinue, flags[FeatureFlagsKeys.MAGIC_TEST], searchParams, redirectTo])

  const handleTryAgain = useCallback(() => {
    navigate(locations.login({ redirectTo }), { replace: true })
  }, [navigate, redirectTo])

  useEffect(() => {
    if (!logInStarted && initialized) {
      setLogInStarted(true)
      logInAndRedirect()
    }
  }, [logInAndRedirect, initialized, logInStarted])

  return (
    <Container>
      <AnimatedBackground variant="absolute" />
      <Wrapper>
        <ConnectionLayout
          state={layoutState}
          providerType={flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC}
          onTryAgain={handleTryAgain}
          errorDetail={errorDetail}
        />
      </Wrapper>
    </Container>
  )
}

export { CallbackPage }
