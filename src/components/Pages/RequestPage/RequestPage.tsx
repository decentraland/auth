import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ethers } from 'ethers'
import { io } from 'socket.io-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { connection } from 'decentraland-connect'
import { config } from '../../../modules/config'
import styles from './RequestPage.module.css'

enum View {
  TIMEOUT,
  // Loading
  LOADING_REQUEST,
  LOADING_ERROR,
  // Verify Sign In
  VERIFY_SIGN_IN,
  VERIFY_SIGN_IN_DENIED,
  VERIFY_SIGN_IN_ERROR,
  VERIFY_SIGN_IN_COMPLETE,
  // Wallet Interaction
  WALLET_INTERACTION,
  WALLET_INTERACTION_DENIED,
  WALLET_INTERACTION_ERROR,
  WALLET_INTERACTION_COMPLETE
}

export const RequestPage = () => {
  const params = useParams()
  const navigate = useNavigate()
  const [view, setView] = useState(View.LOADING_REQUEST)
  const requestRef = useRef<any>()
  const errorRef = useRef<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()

  const requestId = params.requestId ?? ''

  useEffect(() => {
    ;(async () => {
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
        requestRef.current = request

        timeoutRef.current = setTimeout(() => {
          setView(View.TIMEOUT)
        }, new Date(request.expiration).getTime() - Date.now())

        if (request.method === 'dcl_personal_sign') {
          setView(View.VERIFY_SIGN_IN)
        } else {
          setView(View.WALLET_INTERACTION)
        }
      } catch (e) {
        errorRef.current = (e as Error).message
        setView(View.LOADING_ERROR)
      }
    })()
  }, [])

  const getProvider = useCallback(async () => {
    return new ethers.BrowserProvider(await connection.getProvider())
  }, [])

  const onDenyVerifySignIn = useCallback(() => {
    setView(View.VERIFY_SIGN_IN_DENIED)
  }, [])

  const onApproveSignInVerification = useCallback(async () => {
    const provider = await getProvider()
    const signer = await provider.getSigner()
    const signature = await signer.signMessage(requestRef.current.params[0])
    const result = await authServerFetch('outcome', {
      requestId,
      sender: await signer.getAddress(),
      result: signature
    })

    clearTimeout(timeoutRef.current)

    if (result.error) {
      errorRef.current = result.error
      setView(View.VERIFY_SIGN_IN_ERROR)
    } else {
      setView(View.VERIFY_SIGN_IN_COMPLETE)
    }
  }, [getProvider])

  const onDenyWalletInteraction = useCallback(() => {
    setView(View.WALLET_INTERACTION_DENIED)
  }, [])

  const onApproveWalletInteraction = useCallback(async () => {
    const provider = await getProvider()
    const signer = await provider.getSigner()
    const result = await provider.send(requestRef.current.method, requestRef.current.params)
    const fetchResult = await authServerFetch('outcome', {
      requestId,
      sender: await signer.getAddress(),
      result
    })

    clearTimeout(timeoutRef.current)

    if (fetchResult.error) {
      errorRef.current = fetchResult.error
      setView(View.WALLET_INTERACTION_ERROR)
    } else {
      setView(View.WALLET_INTERACTION_COMPLETE)
    }
  }, [getProvider])

  if (view === View.TIMEOUT) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.errorLogo}></div>
          <div className={styles.errorTitle}>Looks like you took too long and the request has expired</div>
          <div className={styles.errorSubtitle}>Please return to Decentraland's Desktop App to try again.</div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  // Loading

  if (view === View.LOADING_REQUEST) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <Loader active size="huge" />
        </div>
      </main>
    )
  }

  if (view === View.LOADING_ERROR) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.errorLogo}></div>
          <div className={styles.errorTitle}>There was an error recovering the request...</div>
          <div className={styles.errorSubtitle}>The request is not available anymore. Feel free to create a new one and try again.</div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  // Verify Sign In

  if (view === View.VERIFY_SIGN_IN && requestRef.current) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.logo}></div>
          <div className={styles.title}>Verify Sign In</div>
          <div className={styles.description}>Do you see the same verification number on your Desktop App?</div>
          <div className={styles.code}>{requestRef.current.code}</div>
          <div className={styles.buttons}>
            <Button className={styles.noButton} onClick={onDenyVerifySignIn}>
              <div className={styles.noLogo}></div> No
            </Button>
            <Button className={styles.yesButton} onClick={onApproveSignInVerification}>
              <div className={styles.yesLogo}></div> Yes, they are the same
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (view === View.VERIFY_SIGN_IN_DENIED) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.errorLogo}></div>
          <div className={styles.errorTitle}>Did the number not match, or was this action not taken by you?</div>
          <div className={styles.errorSubtitle}>
            If you're trying to sign in, retry the action. If this action was not initiated by you, dismiss this message.
          </div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  if (view === View.VERIFY_SIGN_IN_COMPLETE) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.logo}></div>
          <div className={styles.title}>Your account is ready!</div>
          <div className={styles.description}>Return to the Desktop App and enjoy Decentraland.</div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  // Wallet Interaction

  if (view === View.WALLET_INTERACTION && requestRef.current) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.logo}></div>
          <div className={styles.title}>The Desktop App wants to interact with your wallet.</div>
          <div className={styles.description}>Review the following data carefully on your wallet before approving it.</div>
          <div className={styles.buttons}>
            <Button className={styles.noButton} onClick={onDenyWalletInteraction}>
              <div className={styles.noLogo}></div>Deny
            </Button>
            <Button className={styles.yesButton} onClick={onApproveWalletInteraction}>
              <div className={styles.yesLogo}></div>Allow
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (view === View.WALLET_INTERACTION_DENIED) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.errorLogo}></div>
          <div className={styles.errorTitle}>Was this action not initiated by you?</div>
          <div className={styles.errorSubtitle}>If this action was not initiated by you, dismiss this message.</div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  if (view === View.WALLET_INTERACTION_COMPLETE) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.logo}></div>
          <div className={styles.title}>Wallet interaction complete</div>
          <div className={styles.description}>The action has been executed successfuly.</div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  // Shared

  if (view === View.VERIFY_SIGN_IN_ERROR || view === View.WALLET_INTERACTION_ERROR) {
    return (
      <main className={styles.main}>
        <div className={styles.left}>
          <div className={styles.errorLogo}></div>
          <div className={styles.errorTitle}>There was an error while trying to submit the request.</div>
          <div className={styles.errorSubtitle}>Return to the Desktop App to try again, or contant support if the error persists.</div>
          <CloseWindow />
        </div>
      </main>
    )
  }

  return null
}

const CloseWindow = () => {
  return <div className={styles.closeWindow}>You can close this window.</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
