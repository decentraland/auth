import { useCallback, useContext, useEffect, useState } from 'react'
import { ProviderType } from '@dcl/schemas'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useAuthFlow } from '../../../hooks/useAuthFlow'
import { ConnectionType } from '../../../modules/analytics/types'
import { extractReferrerFromSearchParameters, locations } from '../../../shared/locations'
import { handleError } from '../../../shared/utils/errorHandler'
import { createMagicInstance } from '../../../shared/utils/magicSdk'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { FeatureFlagsContext } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'

export const CallbackPage = () => {
  const { redirect } = useAfterLoginRedirection()
  const navigate = useNavigateWithSearchParams()
  const [logInStarted, setLogInStarted] = useState(false)
  const { initialized } = useContext(FeatureFlagsContext)
  const { connectToMagic, checkProfileAndRedirect, shouldUseTestMagic } = useAuthFlow()
  const { trackLoginSuccess } = useAnalytics()

  const connectAndGenerateSignature = useCallback(async () => {
    const connectionData = await connectToMagic()
    await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
    return connectionData
  }, [connectToMagic])

  const handleContinue = useCallback(
    async (referrer: string | null) => {
      try {
        const connectionData = await connectAndGenerateSignature()
        const ethAddress = connectionData.account?.toLowerCase() ?? ''

        await trackLoginSuccess({
          ethAddress,
          type: ConnectionType.WEB2
        })

        await checkProfileAndRedirect(connectionData.account ?? '', referrer, redirect)
      } catch (error) {
        handleError(error, 'Error in callback continue flow')
        navigate(locations.login())
      }
    },
    [navigate, connectAndGenerateSignature, redirect, trackLoginSuccess, checkProfileAndRedirect]
  )

  const logInAndRedirect = useCallback(async () => {
    try {
      const magic = await createMagicInstance(shouldUseTestMagic())
      const search = new URLSearchParams(window.location.search)
      const referrer = extractReferrerFromSearchParameters(search)
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
  }, [navigate, handleContinue, shouldUseTestMagic])

  useEffect(() => {
    if (!logInStarted && initialized) {
      setLogInStarted(true)
      logInAndRedirect()
    }
  }, [logInAndRedirect, initialized, logInStarted])

  return (
    <ConnectionModal
      open={true}
      state={ConnectionModalState.VALIDATING_SIGN_IN}
      onTryAgain={connectAndGenerateSignature}
      providerType={shouldUseTestMagic() ? ProviderType.MAGIC_TEST : ProviderType.MAGIC}
    />
  )
}
