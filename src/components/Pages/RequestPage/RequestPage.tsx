import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ethers } from 'ethers'
import { io } from 'socket.io-client'
import { connection } from 'decentraland-connect'
import { config } from '../../../modules/config'

export const RequestPage = () => {
  const params = useParams()
  const requestId = params.requestId ?? ''
  const { request, error: recoverError } = useRecoverRequestFromAuthServer(requestId)

  if (recoverError) {
    return <div style={{ margin: '1rem' }}>Could not recover request...</div>
  }

  if (!request) {
    return <div style={{ margin: '1rem' }}>Loading...</div>
  }

  if (request.method === 'dcl_personal_sign') {
    return (
      <div style={{ margin: '1rem' }}>
        <h1>{request.method}</h1>
        <pre>{request.params[0]}</pre>
        <div>
          Code: <b>{request.code}</b> (This code should be visible on the desktop client as well)
        </div>
        <button
          style={{ marginTop: '1rem' }}
          onClick={async () => {
            const provider = await connection.getProvider()
            const browserProvider = new ethers.BrowserProvider(provider)
            const signer = await browserProvider.getSigner()
            const signature = await signer.signMessage(request.params[0])
            await authServerFetch('outcome', { requestId, sender: await signer.getAddress(), result: signature })
          }}
        >
          Sign Ephemeral Message
        </button>
      </div>
    )
  } else {
    return (
      <div style={{ margin: '1rem' }}>
        <h1>{request.method}</h1>
        <pre>{JSON.stringify(request.params)}</pre>
        <button
          style={{ marginTop: '1rem' }}
          onClick={async () => {
            const provider = await connection.getProvider()
            const browserProvider = new ethers.BrowserProvider(provider)
            const signer = await browserProvider.getSigner()
            const result = await browserProvider.send(request.method, request.params)
            await authServerFetch('outcome', { requestId, sender: await signer.getAddress(), result })
          }}
        >
          Execute
        </button>
      </div>
    )
  }
}

/**
 * Recovers a request with the provided request id from the auth server.
 * If the user is not connected, it will be redirected to the login page.
 * It is expected that once the user is logged in, it is redirected back to this page.
 */
const useRecoverRequestFromAuthServer = (requestId: string) => {
  const navigate = useNavigate()

  const [request, setRequest] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRequest = useCallback(async () => {
    try {
      // Try to restablish connection with the wallet.
      await connection.tryPreviousConnection()
    } catch (e) {
      // If it fails it is because there is no connection and the user needs to login.
      // The user should login and then be redirected back to this page to continue the transaction.
      navigate(`/login?redirectTo=/auth/requests/${requestId}`)
      return
    }

    try {
      const request = await authServerFetch('recover', { requestId })
      setRequest(request)
    } catch (e) {
      console.log(e)
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    fetchRequest()
  }, [])

  return {
    request,
    error
  }
}

const authServerFetch = async (ev: string, msg: any) => {
  const authServerUrl = config.get('AUTH_SERVER_URL')
  const socket = io(authServerUrl)

  await new Promise<void>(resolve => {
    socket.on('connect', resolve)
  })

  const response = await socket.emitWithAck(ev, msg)

  socket.close()

  if (response.error) {
    throw new Error(response.error)
  }

  return response
}
