import { useCallback, useContext, useEffect, useState } from 'react'
import { captureException } from '@sentry/react'
import { ProviderType } from '@dcl/schemas'
import { getConfiguration, connection } from 'decentraland-connect'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ConnectionType, TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { isErrorWithMessage } from '../../../shared/errors'
import { locations } from '../../../shared/locations'
import { wait } from '../../../shared/time'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'

export const CallbackPage = () => {
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const navigate = useNavigateWithSearchParams()
  const [logInStarted, setLogInStarted] = useState(false)
  const { flags, initialized } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

  const connectAndGenerateSignature = useCallback(async () => {
    const connectionData = await connection.connect(flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC)
    await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
    return connectionData
  }, [flags[FeatureFlagsKeys.MAGIC_TEST]])

  const handleContinue = useCallback(async () => {
    try {
      const connectionData = await connectAndGenerateSignature()
      const ethAddress = connectionData.account?.toLowerCase() ?? ''
      getAnalytics()?.identify({ ethAddress })
      // eslint-disable-next-line @typescript-eslint/naming-convention
      getAnalytics()?.track(TrackingEvents.LOGIN_SUCCESS, { eth_address: ethAddress, type: ConnectionType.WEB2 })
      // Wait 800 ms for the tracking to be completed
      await wait(800)

      // If the flag is enabled and the setup is not skipped by config, proceed with the simplified avatar setup flow.
      if (!targetConfig.skipSetup) {
        // Can only proceed if the connection data has an account. Without the account the profile cannot be fetched.
        // Continues with the original flow if the account is not present.
        if (connectionData.account) {
          const profile = await fetchProfile(connectionData.account)

          // If the connected account does not have a profile, redirect the user to the setup page to create a new one.
          // The setup page should then redirect the user to the url provided as query param if available.
          if (!profile) {
            let referrer
            const url = new URL(window.location.href)
            const state = url.searchParams.get('state')
            if (state) {
              const stateRedirectToParam = atob(state)

              const parsedCustomData = JSON.parse(stateRedirectToParam).customData
              referrer = JSON.parse(parsedCustomData).referrer
            }

            return navigate(locations.setup(redirectTo, referrer))
          }
        }
      }

      redirect()
    } catch (error) {
      console.log(error)
      captureException(error)
      navigate(locations.login())
    }
  }, [navigate, redirectTo, connectAndGenerateSignature, redirect])

  const logInAndRedirect = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth2')
    const MAGIC_KEY = flags[FeatureFlagsKeys.MAGIC_TEST] ? getConfiguration().magic_test.apiKey : getConfiguration().magic.apiKey
    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })

    try {
      await magic?.oauth2.getRedirectResult()
      handleContinue()
    } catch (error) {
      console.error('Error logging in', error)
      captureException(error)
      getAnalytics()?.track(TrackingEvents.LOGIN_ERROR, { error: isErrorWithMessage(error) ? error.message : error })
      await wait(800)
      navigate(locations.login())
    }
  }, [navigate, handleContinue, flags[FeatureFlagsKeys.MAGIC_TEST]])

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
      providerType={flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC}
    />
  )
}
