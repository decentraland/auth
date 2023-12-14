import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Socket, io } from 'socket.io-client'
import { connection } from 'decentraland-connect'
import { config } from '../../../modules/config'
import { SignaturePage } from './SignaturePage/SignaturePage'

export const RequestPage = () => {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef<Socket>()
  // TODO: Show error somewehere.
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<any | null>(null)

  const initialize = useCallback(async () => {
    try {
      // Try to restablish connection with the wallet.
      await connection.tryPreviousConnection()
    } catch (e) {
      // If it fails it is because there is no connection and the user needs to login.
      // The user should login and then be redirected back to this page to continue the transaction.
      navigate(`/login?redirectTo=/requests/${requestId}`)
      return
    }

    try {
      const authServerUrl = config.get('AUTH_SERVER_URL')

      if (!authServerUrl) {
        throw new Error('Missing AUTH_SERVER_URL')
      }

      // Connects the browser to the auth server to enable messaging.
      const socket = io(authServerUrl, {})

      socket.on('connect', () => {
        // Store a reference to the socket once it is connected so it can be used elsewhere.
        socketRef.current = socket

        // Once connected, recover the request data sent by the client from the auth server.
        socket.emit('message', {
          type: 'recover',
          payload: {
            requestId
          }
        })
      })

      socket.on('message', (message: any) => {
        // When the request data is retrieved, store it in the state.
        // Now the UI should be ready to display what the client intends to do.
        if (message.payload.requestId === requestId) {
          if (message.payload.error) {
            console.error(message.payload.error)
            setError(message.payload.error)
          } else {
            setRequest(message)
          }
        }
      })
    } catch (e) {
      console.error(e as Error)
      setError('Cannot connect to the auth server')
    }
  }, [])

  useEffect(() => {
    initialize()

    return () => {
      // Close the socket connection when the component is unmounted.
      socketRef.current?.close()
    }
  }, [])

  if (error) {
    return (
      <div style={{ margin: '1rem' }}>
        Failed to fetch the client request from the auth server: <b>${error}</b>
      </div>
    )
  }

  if (!request) {
    return <div style={{ margin: '1rem' }}>Fetching client request from the auth server...</div>
  }

  switch (request.payload.type) {
    case 'signature':
      return <SignaturePage request={request} socketRef={socketRef} />
    default:
      return <div style={{ margin: '1rem' }}>Invalid request type: "{request.payload.type}"</div>
  }
}
