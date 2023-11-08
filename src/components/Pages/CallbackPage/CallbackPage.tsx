import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProviderType } from '@dcl/schemas'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { getConfiguration, connection } from 'decentraland-connect'
import { useAfterLoginRedirection } from '../../../hooks/redirection'

const MAGIC_KEY = getConfiguration().magic.apiKey

export const CallbackPage = () => {
  const redirectTo = useAfterLoginRedirection()
  const navigate = useNavigate()

  const logInAndRedirect = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { Magic } = await import('magic-sdk')
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { OAuthExtension } = await import('@magic-ext/oauth')

    const magic = new Magic(MAGIC_KEY, {
      extensions: [new OAuthExtension()]
    })

    try {
      await magic?.oauth.getRedirectResult()
      // Perform the connection once logged in to store the connection data
      await connection.connect(ProviderType.MAGIC)
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

  return <Loader active size="huge" />
}
