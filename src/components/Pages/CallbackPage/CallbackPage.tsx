import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { getConfiguration, connection } from 'decentraland-connect'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { TrackingEvents } from '../../../modules/analytics/types'
import { wait } from '../../../shared/time'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { getIdentitySignature } from '../LoginPage/utils'

const MAGIC_KEY = getConfiguration().magic.apiKey

export const CallbackPage = () => {
  usePageTracking()
  const redirectTo = useAfterLoginRedirection()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  const connectAndGenerateSignature = useCallback(async () => {
    const connectionData = await connection.connect(ProviderType.MAGIC)
    await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
    return connectionData
  }, [])

  const logInAndRedirect = useCallback(async () => {
    const analytics = getAnalytics()
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
      await magic?.oauth.getRedirectResult()
      // Perform the connection once logged in to store the connection data
      setIsLoading(false)
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
  }, [navigate])

  useEffect(() => {
    logInAndRedirect()
  }, [])

  return (
    <ConnectionModal
      open={true}
      state={isLoading ? ConnectionModalState.VALIDATING_SIGN_IN : ConnectionModalState.WAITING_FOR_SIGNATURE}
      onTryAgain={connectAndGenerateSignature}
      providerType={ProviderType.MAGIC}
    />
  )
}
