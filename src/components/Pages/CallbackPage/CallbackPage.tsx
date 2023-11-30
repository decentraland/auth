import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { getConfiguration, connection } from 'decentraland-connect'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { getSignature } from '../LoginPage/utils'

const MAGIC_KEY = getConfiguration().magic.apiKey

export const CallbackPage = () => {
  const redirectTo = useAfterLoginRedirection()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  const getUserSignature = useCallback(async () => {
    const connectionData = await connection.connect(ProviderType.MAGIC)
    await getSignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
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
      await magic?.oauth.getRedirectResult()
      // Perform the connection once logged in to store the connection data
      setIsLoading(false)
      getUserSignature()

      if (redirectTo) {
        window.location.href = redirectTo
      } else {
        // Navigate to user or to any other site
        navigate('/user')
      }
    } catch (error) {
      console.log(error)
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    logInAndRedirect()
  }, [])

  return isLoading ? (
    <Loader active size="huge" />
  ) : (
    <ConnectionModal
      open={true}
      state={ConnectionModalState.WAITING_FOR_SIGNATURE}
      onTryAgain={getUserSignature}
      onClose={() => undefined}
    />
  )
}
