import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ethers } from 'ethers'
import { io } from 'socket.io-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { WearablePreview } from 'decentraland-ui/dist/components/WearablePreview/WearablePreview'
import { connection } from 'decentraland-connect'
import { config } from '../../../modules/config'
import { isErrorWithMessage } from '../../../shared/errors'
import styles from './RequestPage.module.css'

enum View {
  TIMEOUT,
  DIFFERENT_ACCOUNT,
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
  const [isLoading, setIsLoading] = useState(false)
  const requestRef = useRef<any>()
  const [error, setError] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const connectedAccountRef = useRef<string>()
  const requestId = params.requestId ?? ''

  const getProvider = useCallback(async () => {
    return new ethers.BrowserProvider(await connection.getProvider())
  }, [])

  // Goes to the login page where the user will have to connect a wallet.
  const toLoginPage = useCallback(() => {
    navigate(`/login?redirectTo=/auth/requests/${requestId}&fromRequests=true`)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        // Try to restablish connection with the wallet.
        await connection.tryPreviousConnection()
      } catch (e) {
        toLoginPage()
        return
      }

      try {
        // Recover the request from the auth server.
        const request = await authServerFetch('recover', { requestId })
        requestRef.current = request

        const provider = await getProvider()
        const signer = await provider.getSigner()
        const signerAddress = await signer.getAddress()

        connectedAccountRef.current = signerAddress

        // If the sender defined in the request is different than the one that is connected, show an error.
        if (request.sender && request.sender !== signerAddress.toLowerCase()) {
          setView(View.DIFFERENT_ACCOUNT)
          return
        }

        // Initialize the timeout to display the timeout view when the request expires.
        timeoutRef.current = setTimeout(() => {
          setView(View.TIMEOUT)
        }, new Date(request.expiration).getTime() - Date.now())

        // Show different views depending on the request method.
        if (request.method === 'dcl_personal_sign') {
          setView(View.VERIFY_SIGN_IN)
        } else {
          setView(View.WALLET_INTERACTION)
        }
      } catch (e) {
        setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
        setView(View.LOADING_ERROR)
      }
    })()

    return () => {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    // The timeout is only necessary on the verify sign in and wallet interaction views.
    // We can clear it out when the user is shown another view to prevent the timeout from triggering somewhere not intended.
    if (view !== View.VERIFY_SIGN_IN && view !== View.WALLET_INTERACTION) {
      clearTimeout(timeoutRef.current)
    }
  }, [view])

  const onDenyVerifySignIn = useCallback(() => {
    setView(View.VERIFY_SIGN_IN_DENIED)
  }, [])

  const onApproveSignInVerification = useCallback(async () => {
    setIsLoading(true)
    try {
      const provider = await getProvider()
      const signer = await provider.getSigner()
      const signature = await signer.signMessage(requestRef.current.params[0])
      const result = await authServerFetch('outcome', {
        requestId,
        sender: await signer.getAddress(),
        result: signature
      })

      if (result.error) {
        throw new Error(result.error)
      } else {
        setView(View.VERIFY_SIGN_IN_COMPLETE)
      }
    } catch (e) {
      setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
      setView(View.VERIFY_SIGN_IN_ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [getProvider, setIsLoading])

  const onDenyWalletInteraction = useCallback(() => {
    setView(View.WALLET_INTERACTION_DENIED)
  }, [])

  const onApproveWalletInteraction = useCallback(async () => {
    setIsLoading(true)
    try {
      const provider = await getProvider()
      const signer = await provider.getSigner()
      const result = await provider.send(requestRef.current.method, requestRef.current.params)
      const fetchResult = await authServerFetch('outcome', {
        requestId,
        sender: await signer.getAddress(),
        result
      })

      if (fetchResult.error) {
        throw new Error(fetchResult.error)
      } else {
        setView(View.WALLET_INTERACTION_COMPLETE)
      }
    } catch (e) {
      setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
      setView(View.WALLET_INTERACTION_ERROR)
    }
  }, [getProvider])

  const onChangeAccount = useCallback(async () => {
    await connection.disconnect()
    toLoginPage()
  }, [])

  const Container = useCallback((props: { children: ReactNode; canChangeAccount?: boolean; isLoading?: boolean }) => {
    return (
      <div>
        <div className={styles.background} />
        <div className={styles.main}>
          <div className={styles.left}>{props.children}</div>
          <div className={styles.right}>
            {connectedAccountRef.current ? (
              <>
                <WearablePreview
                  lockBeta={true}
                  panning={false}
                  disableBackground={true}
                  profile={connectedAccountRef.current}
                  dev={false}
                />
                {props.canChangeAccount ? (
                  <div className={styles.changeAccount}>
                    <Button disabled={isLoading} inverted onClick={onChangeAccount}>
                      Change Account
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    )
  }, [])

  if (view === View.TIMEOUT) {
    return (
      <Container>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>Looks like you took too long and the request has expired</div>
        <div className={styles.description}>Please return to Decentraland's Desktop App to try again.</div>
        <CloseWindow />
      </Container>
    )
  }

  if (view === View.DIFFERENT_ACCOUNT) {
    return (
      <Container canChangeAccount>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>Looks like you are connected with a different account.</div>
        <div className={styles.description}>Please change your wallet account to the one connected to the Desktop App.</div>
      </Container>
    )
  }

  // Loading

  if (view === View.LOADING_REQUEST) {
    return (
      <Container>
        <div className={styles.left}>
          <Loader active size="huge" />
        </div>
      </Container>
    )
  }

  if (view === View.LOADING_ERROR) {
    return (
      <Container>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>There was an error recovering the request...</div>
        <div className={styles.description}>The request is not available anymore. Feel free to create a new one and try again.</div>
        <CloseWindow />
        <div className={styles.errorMessage}>{error}</div>
      </Container>
    )
  }

  // Verify Sign In

  if (view === View.VERIFY_SIGN_IN && requestRef.current) {
    return (
      <Container canChangeAccount isLoading={isLoading}>
        <div className={styles.logo}></div>
        <div className={styles.title}>Verify Sign In</div>
        <div className={styles.description}>Do you see the same verification number on your Desktop App?</div>
        <div className={styles.code}>{requestRef.current.code}</div>
        <div className={styles.buttons}>
          <Button inverted disabled={isLoading} onClick={onDenyVerifySignIn}>
            No
          </Button>
          <Button primary loading={isLoading} disabled={isLoading} onClick={onApproveSignInVerification}>
            Yes, they are the same
          </Button>
        </div>
      </Container>
    )
  }

  if (view === View.VERIFY_SIGN_IN_DENIED) {
    return (
      <Container canChangeAccount>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>Did the number not match, or was this action not taken by you?</div>
        <div className={styles.description}>
          If you're trying to sign in, retry the action. If this action was not initiated by you, dismiss this message.
        </div>
        <CloseWindow />
      </Container>
    )
  }

  if (view === View.VERIFY_SIGN_IN_COMPLETE) {
    return (
      <Container>
        <div className={styles.logo}></div>
        <div className={styles.title}>Your account is ready!</div>
        <div className={styles.description}>Return to the Desktop App and enjoy Decentraland.</div>
        <CloseWindow />
      </Container>
    )
  }

  // Wallet Interaction

  if (view === View.WALLET_INTERACTION && requestRef.current) {
    return (
      <Container canChangeAccount isLoading={isLoading}>
        <div className={styles.logo}></div>
        <div className={styles.title}>The Desktop App wants to interact with your wallet.</div>
        <div className={styles.description}>Review the following data carefully on your wallet before approving it.</div>
        <div className={styles.buttons}>
          <Button inverted disabled={isLoading} onClick={onDenyWalletInteraction}>
            Deny
          </Button>
          <Button primary disabled={isLoading} loading={isLoading} onClick={onApproveWalletInteraction}>
            Allow
          </Button>
        </div>
      </Container>
    )
  }

  if (view === View.WALLET_INTERACTION_DENIED) {
    return (
      <Container>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>Was this action not initiated by you?</div>
        <div className={styles.description}>If this action was not initiated by you, dismiss this message.</div>
        <CloseWindow />
      </Container>
    )
  }

  if (view === View.WALLET_INTERACTION_COMPLETE) {
    return (
      <Container>
        <div className={styles.logo}></div>
        <div className={styles.title}>Wallet interaction complete</div>
        <div className={styles.description}>The action has been executed successfully.</div>
        <CloseWindow />
      </Container>
    )
  }

  // Shared

  if (view === View.VERIFY_SIGN_IN_ERROR || view === View.WALLET_INTERACTION_ERROR) {
    return (
      <Container>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>There was an error while trying to submit the request.</div>
        <div className={styles.description}>Return to the Desktop App to try again, or contact support if the error persists.</div>
        <CloseWindow />
        <div className={styles.errorMessage}>{error}</div>
      </Container>
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
