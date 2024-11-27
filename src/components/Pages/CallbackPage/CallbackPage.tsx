import { useCallback, useContext, useEffect, useState } from 'react'
import { ProviderType } from '@dcl/schemas'
import { Env } from '@dcl/ui-env'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { getConfiguration, connection } from 'decentraland-connect'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { TrackingEvents } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { fetchProfile } from '../../../modules/profile'
import { locations } from '../../../shared/locations'
import { wait } from '../../../shared/time'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'
import styles from './CallbackPage.module.css'

export const CallbackPage = () => {
  usePageTracking()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const navigate = useNavigateWithSearchParams()
  const [logInStarted, setLogInStarted] = useState(false)
  const [state, setConnectionModalState] = useState(ConnectionModalState.WAITING_FOR_CONFIRMATION)
  const { flags, initialized } = useContext(FeatureFlagsContext)
  const [targetConfig] = useTargetConfig()

  const connectAndGenerateSignature = useCallback(async () => {
    const connectionData = await connection.connect(flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC)
    await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
    return connectionData
  }, [flags[FeatureFlagsKeys.MAGIC_TEST]])

  const logInAndRedirect = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth')
    const MAGIC_KEY = flags[FeatureFlagsKeys.MAGIC_TEST] ? getConfiguration().magic_test.apiKey : getConfiguration().magic.apiKey
    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })

    try {
      setConnectionModalState(ConnectionModalState.VALIDATING_SIGN_IN)
      await magic?.oauth.getRedirectResult()
      setConnectionModalState(ConnectionModalState.WAITING_FOR_CONFIRMATION)
    } catch (error) {
      console.log(error)
      navigate(locations.login())
    }
  }, [navigate, flags[FeatureFlagsKeys.MAGIC_TEST]])

  useEffect(() => {
    if (((config.is(Env.DEVELOPMENT) && initialized) || !config.is(Env.DEVELOPMENT)) && !logInStarted) {
      setLogInStarted(true)
      logInAndRedirect()
    }
  }, [logInAndRedirect, initialized, logInStarted])

  const handleContinue = useCallback(async () => {
    try {
      setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
      const connectionData = await connectAndGenerateSignature()
      const ethAddress = connectionData.account?.toLowerCase() ?? ''
      getAnalytics().identify({ ethAddress })
      // eslint-disable-next-line @typescript-eslint/naming-convention
      getAnalytics().track(TrackingEvents.LOGIN_SUCCESS, { eth_address: ethAddress })
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
            return navigate(locations.setup(redirectTo))
          }
        }
      }

      redirect()
    } catch (error) {
      console.log(error)
      navigate(locations.login())
    }
  }, [navigate, redirectTo, connectAndGenerateSignature, redirect])

  if (state === ConnectionModalState.WAITING_FOR_CONFIRMATION) {
    return (
      <Modal size="tiny" open>
        <div className={styles.container}>
          <h3 className={styles.title}>Confirm your login</h3>
          <div className={styles.info}>
            <span>The next step only verifies your identity.</span>
            <span>No payments or transactions will occur without your explicit approval.</span>
          </div>
          <Button primary onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <ConnectionModal
      open={true}
      state={state}
      onTryAgain={connectAndGenerateSignature}
      providerType={flags[FeatureFlagsKeys.MAGIC_TEST] ? ProviderType.MAGIC_TEST : ProviderType.MAGIC}
    />
  )
}
