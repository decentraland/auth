import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ethers } from 'ethers'
import { io } from 'socket.io-client'
import { connection } from 'decentraland-connect'
import { config } from '../../../modules/config'
import styles from './RequestPage.module.css'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'

export const RequestPage = () => {
  const params = useParams()
  const requestId = params.requestId ?? ''
  const { request, error: recoverError } = useRecoverRequestFromAuthServer(requestId)

  if (recoverError) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.errorLogo}></div>
          <div className={styles.errorTitle}>There was an error obtaining your request...</div>
          <div className={styles.errorSubtitle}>Close this window and try again.</div>
          <div className={styles.errorValue}>{recoverError}</div>
        </div>
      </main>
    )
  }

  if (!request) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <Loader active size="huge" />
        </div>
      </main>
    )
  }

  console.log(request)

  if (request.method === 'dcl_personal_sign') {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.logo}></div>
          <div className={styles.title}>Verify Sign In</div>
          <div className={styles.description}>Do you see the same verification number on your desktop app?</div>
          <div className={styles.code}>{request.code}</div>
          <div className={styles.buttons}>
            <Button className={styles.noButton}>
              <div className={styles.noLogo}></div> No
            </Button>
            <Button
              className={styles.yesButton}
              onClick={async () => {
                const provider = await connection.getProvider()
                const browserProvider = new ethers.BrowserProvider(provider)
                const signer = await browserProvider.getSigner()
                const signature = await signer.signMessage(request.params[0])
                await authServerFetch('outcome', { requestId, sender: await signer.getAddress(), result: signature })
              }}
            >
              <div className={styles.yesLogo}></div> Yes, they are the same
            </Button>
          </div>
        </div>
      </main>
    )
  } else {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.logo}></div>
          <div className={styles.title}>Remote Wallet Interaction</div>
          <div className={styles.description}>The desktop app is trying to interact with your wallet.</div>
          <div className={styles.buttons}>
            <Button className={styles.noButton}>
              <div className={styles.noLogo}></div>Deny
            </Button>
            <Button
              className={styles.yesButton}
              onClick={async () => {
                const provider = await connection.getProvider()
                const browserProvider = new ethers.BrowserProvider(provider)
                const signer = await browserProvider.getSigner()
                const result = await browserProvider.send(request.method, request.params)
                await authServerFetch('outcome', { requestId, sender: await signer.getAddress(), result })
              }}
            >
              <div className={styles.yesLogo}></div>Allow
            </Button>
          </div>
        </div>
      </main>
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
