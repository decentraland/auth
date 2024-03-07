import { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { getConfiguration, connection } from 'decentraland-connect'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { TrackingEvents } from '../../../modules/analytics/types'
import { fetchProfile } from '../../../modules/profile'
import { wait } from '../../../shared/time'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { getIdentitySignature } from '../LoginPage/utils'
import styles from './CallbackPage.module.css'

const MAGIC_KEY = getConfiguration().magic.apiKey

export const CallbackPage = () => {
  usePageTracking()
  const redirectTo = useAfterLoginRedirection()
  const navigate = useNavigate()
  const [state, setConnectionModalState] = useState(ConnectionModalState.WAITING_FOR_CONFIRMATION)
  const { flags } = useContext(FeatureFlagsContext)

  const connectAndGenerateSignature = useCallback(async () => {
    const connectionData = await connection.connect(ProviderType.MAGIC)
    await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
    return connectionData
  }, [])

  const logInAndRedirect = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth')

    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })

    try {
      setConnectionModalState(ConnectionModalState.VALIDATING_SIGN_IN)
      await magic?.oauth.getRedirectResult()
      setConnectionModalState(ConnectionModalState.WAITING_FOR_CONFIRMATION)
    } catch (error) {
      console.log(error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    logInAndRedirect()
  }, [])

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

      // If the flag is enabled, proceed with the simplified avatar setup flow.
      if (flags[FeatureFlagsKeys.SIMPLIFIED_AVATAR_SETUP]) {
        // Can only proceed if the connection data has an account. Without the account the profile cannot be fetched.
        // Continues with the original flow if the account is not present.
        if (connectionData.account) {
          const profile = await fetchProfile(connectionData.account)

          // If the connected account does not have a profile, redirect the user to the setup page to create a new one.
          // The setup page should then redirect the user to the url provided as query param if available.
          if (!profile) {
            window.location.href = '/auth/setup' + (redirectTo ? `?redirectTo=${redirectTo}` : '')
            return
          }
        }
      }

      if (redirectTo) {
        // If redirection url is present, redirect the user to that url.
        window.location.href = decodeURIComponent(redirectTo)
      } else {
        // Navigate to the landing page if there is no other place to redirect.
        window.location.href = '/'
      }
    } catch (error) {
      console.log(error)
      navigate('/login')
    }
  }, [navigate, redirectTo, flags])

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

  return <ConnectionModal open={true} state={state} onTryAgain={connectAndGenerateSignature} providerType={ProviderType.MAGIC} />
}
