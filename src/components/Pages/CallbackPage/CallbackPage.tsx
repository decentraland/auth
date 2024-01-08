import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { getConfiguration, connection } from 'decentraland-connect'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { TrackingEvents } from '../../../modules/analytics/types'
import { wait } from '../../../shared/time'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { getIdentitySignature } from '../LoginPage/utils'
import styles from './CallbackPage.module.css'

const MAGIC_KEY = getConfiguration().magic.apiKey

export const CallbackPage = () => {
  usePageTracking()
  const redirectTo = useAfterLoginRedirection()
  const navigate = useNavigate()
  const [state, setConnectionModalState] = useState(ConnectionModalState.WAITING_FOR_CONFIRMATION)

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
    const analytics = getAnalytics()
    try {
      setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
      const connectionData = await connectAndGenerateSignature()
      const ethAddress = connectionData.account?.toLowerCase() ?? ''
      analytics.identify({ ethAddress })
      // eslint-disable-next-line @typescript-eslint/naming-convention
      analytics.track(TrackingEvents.LOGIN_SUCCESS, { eth_address: ethAddress })
      // Wait 300 ms for the tracking to be completed
      await wait(500)
      if (redirectTo) {
        window.location.href = decodeURIComponent(redirectTo)
      } else {
        // Navigate to the landing page.
        window.location.href = '/'
      }
    } catch (error) {
      console.log(error)
      navigate('/login')
    }
  }, [])

  if (state === ConnectionModalState.WAITING_FOR_CONFIRMATION) {
    return (
      <Modal size="tiny" open>
        <div className={styles.container}>
          <h3 className={styles.title}>Confirm your login</h3>
          <div className={styles.info}>
            <span>This step only verifies your identity.</span>
            <span>
              No payments or transactions will ocurr without your explicit approval. <a>Learn More</a>
            </span>
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
