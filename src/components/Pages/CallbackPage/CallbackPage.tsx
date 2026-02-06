import { useCallback, useContext, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useAuthFlow } from '../../../hooks/useAuthFlow'
import { ConnectionType } from '../../../modules/analytics/types'
import { extractReferrerFromSearchParameters, locations } from '../../../shared/locations'
import { isMobileSession } from '../../../shared/mobile'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionLayout } from '../../ConnectionModal/ConnectionLayout'
import { ConnectionLayoutState } from '../../ConnectionModal/ConnectionLayout.type'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'
import { MobileCallbackPage } from '../MobileCallbackPage/MobileCallbackPage'
import { Container, Wrapper } from './CallbackPage.styled'

export const CallbackPage = () => {
  // Render mobile callback UI directly if on mobile device
  if (isMobileSession()) {
    return <MobileCallbackPage />
  }

  return <DesktopCallbackPage />
}

const DesktopCallbackPage = () => {
  const { redirect } = useAfterLoginRedirection()
  const navigate = useNavigateWithSearchParams()
  const [searchParams] = useSearchParams()
  const [logInStarted, setLogInStarted] = useState(false)
  const { initialized, flags } = useContext(FeatureFlagsContext)
  const { connectToMagic, checkProfileAndRedirect } = useAuthFlow()
  const { trackLoginSuccess } = useAnalytics()

  const connectAndGenerateSignature = useCallback(async () => {
    if (!initialized) {
      return undefined
    }

    const connectionData = await connectToMagic()
    if (!connectionData) {
      return undefined
    }

    if (connectionData.provider) {
      await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
    }
    return connectionData
  }, [connectToMagic, initialized])

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

        await trackLoginSuccess({
          ethAddress,
          type: ConnectionType.WEB2
        })

        // Get the freshly generated identity from localStorage for Magic flow
        const freshIdentity = localStorageGetIdentity(ethAddress)

        await checkProfileAndRedirect(connectionData.account ?? '', referrer, redirect, freshIdentity)
      } catch (error) {
        handleError(error, 'Error in callback continue flow')
        navigate(locations.login())
      }
    },
    [navigate, connectAndGenerateSignature, redirect, trackLoginSuccess, checkProfileAndRedirect, initialized]
  )

  const logInAndRedirect = useCallback(async () => {
    try {
      const magic = await createMagicInstance(!!flags[FeatureFlagsKeys.MAGIC_TEST])
      const referrer = extractReferrerFromSearchParameters(searchParams)
      const result = await magic?.oauth2.getRedirectResult()

      // Store user email in localStorage if available
      if (result?.oauth?.userInfo?.email) {
        localStorage.setItem('dcl_magic_user_email', result.oauth.userInfo.email)
      }

      handleContinue(referrer)
    } catch (error) {
      handleError(error, 'Error logging in with Magic SDK', {
        skipTracking: false
      })
      navigate(locations.login())
    }
  }, [navigate, handleContinue, flags[FeatureFlagsKeys.MAGIC_TEST], searchParams])

  useEffect(() => {
    if (!logInStarted && initialized) {
      setLogInStarted(true)
      logInAndRedirect()
    }
  }, [logInAndRedirect, initialized, logInStarted])

  return (
    <Container>
      <Wrapper>
        <ConnectionLayout
          state={ConnectionLayoutState.VALIDATING_SIGN_IN}
          providerType={flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC}
          onTryAgain={connectAndGenerateSignature}
        />
      </Wrapper>
    </Container>
  )
}
