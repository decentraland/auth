import { connection } from 'decentraland-connect'
import { ethers } from 'ethers'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Socket, io } from 'socket.io-client'

export const RequestPage = () => {
  const { requestId } = useParams()

  const socketRef = useRef<Socket>()

  const [request, setRequest] = useState<any | null>(null)

  const reconnect = useCallback(async () => {
    try {
      await connection.tryPreviousConnection()
      // const socket = io('https://auth-api.decentraland.today', {})
      const socket = io('http://localhost:8080', {})

      socket.on('connect', () => {
        console.log('socket connected')

        socketRef.current = socket

        socket.emit('message', {
          type: 'recover',
          payload: {
            requestId
          }
        })
      })

      socket.on('message', (message: any) => {
        if (message.payload.requestId === requestId) {
          setRequest(message)
        }
      })

      socket.on('disconnect', () => {
        console.log('socket disconnected')
      })
    } catch (e) {
      console.log('not connected')
    }
  }, [])

  useEffect(() => {
    reconnect()

    return () => {
      socketRef.current?.close()
    }
  }, [])

  return (
    <div>
      <h1>Request Page</h1>
      {request ? (
        <div>
          <h2>Request Data</h2>
          <pre>
            <code>{JSON.stringify(request, null, 2)}</code>
          </pre>
          <button
            onClick={async () => {
              const provider = await connection.getProvider()
              const browserProvider = new ethers.BrowserProvider(provider)
              const signer = await browserProvider.getSigner()
              const signature = await signer.signMessage(request.payload.data)

              socketRef.current?.emit('message', {
                type: 'submit-signature',
                payload: {
                  requestId,
                  signer: signer.address,
                  signature
                }
              })
            }}
          >
            Sign
          </button>
        </div>
      ) : null}
    </div>
  )
}
