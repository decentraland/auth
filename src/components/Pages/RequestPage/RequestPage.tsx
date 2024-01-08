import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ethers, BrowserProvider } from 'ethers'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { io } from 'socket.io-client'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { WearablePreview } from 'decentraland-ui/dist/components/WearablePreview/WearablePreview'
import { connection } from 'decentraland-connect'
import manDefault from '../../../assets/images/ManDefault.webp'
import platformImg from '../../../assets/images/Platform.webp'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { isErrorWithMessage } from '../../../shared/errors'
import { fetchProfile } from './utils'
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
  usePageTracking()
  const analytics = getAnalytics()
  const params = useParams()
  const navigate = useNavigate()
  const providerRef = useRef<BrowserProvider>()
  const [view, setView] = useState(View.LOADING_REQUEST)
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const requestRef = useRef<any>()
  const [error, setError] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const connectedAccountRef = useRef<string>()
  const requestId = params.requestId ?? ''
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)

  // Goes to the login page where the user will have to connect a wallet.
  const toLoginPage = useCallback(() => {
    navigate(`/login?redirectTo=/auth/requests/${requestId}&fromRequests=true`)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        // Try to restablish connection with the wallet.
        const connectionData = await connection.tryPreviousConnection()
        providerRef.current = new ethers.BrowserProvider(connectionData.provider)
      } catch (e) {
        toLoginPage()
        return
      }

      try {
        const signer = await providerRef.current.getSigner()
        const signerAddress = await signer.getAddress()
        analytics.identify({ ethAddress: signerAddress })
        // Recover the request from the auth server.
        const request = await authServerFetch('recover', { requestId })
        requestRef.current = request
        const profile = await fetchProfile(signerAddress)
        setProfile(profile.length ? profile[0] : null)

        connectedAccountRef.current = signerAddress
        setIsLoadingAvatar(true)

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
    analytics.track(TrackingEvents.CLICK, {
      action: ClickEvents.DENY_SIGN_IN
    })
    setView(View.VERIFY_SIGN_IN_DENIED)
  }, [analytics])

  const handleLoadWearablePreview = useCallback(params => {
    if (connectedAccountRef.current && params.profile === connectedAccountRef.current) {
      setIsLoadingAvatar(false)
    }
  }, [])

  const onApproveSignInVerification = useCallback(async () => {
    analytics.track(TrackingEvents.CLICK, {
      action: ClickEvents.APPROVE_SING_IN
    })
    setIsLoading(true)
    const provider = providerRef.current
    try {
      if (!provider) {
        throw new Error('Provider not created')
      }

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
  }, [setIsLoading, analytics])

  const onDenyWalletInteraction = useCallback(() => {
    analytics.track(TrackingEvents.CLICK, {
      action: ClickEvents.DENY_WALLET_INTERACTION
    })
    setView(View.WALLET_INTERACTION_DENIED)
  }, [analytics])

  const onApproveWalletInteraction = useCallback(async () => {
    setIsLoading(true)
    const provider = providerRef.current
    try {
      if (!provider) {
        throw new Error('Provider not created')
      }

      const signer = await provider.getSigner()
      const result = await provider.send(requestRef.current.method, requestRef.current.params)
      analytics.track(TrackingEvents.CLICK, {
        action: ClickEvents.APPROVE_WALLET_INTERACTION,
        method: requestRef.current.method
      })
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
      console.log('Wallet error', JSON.stringify((e as any).info?.error))
      const signer = await providerRef.current?.getSigner()
      if (signer) {
        await authServerFetch('outcome', {
          requestId,
          sender: await signer.getAddress(),
          result: (e as any).info?.error ?? 'Unknown error'
        })
      }
      setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
      setView(View.WALLET_INTERACTION_ERROR)
    }
  }, [analytics])

  const onChangeAccount = useCallback(async evt => {
    evt.preventDefault()
    await connection.disconnect()
    toLoginPage()
  }, [])

  const Container = useCallback(
    (props: { children: ReactNode; canChangeAccount?: boolean; isLoading?: boolean }) => {
      return (
        <div>
          <div
            className={`${styles.background} ${
              (!connectedAccountRef || profile === null) && view !== View.LOADING_REQUEST ? styles.emptyProfile : ''
            }`}
          />
          <div className={styles.main}>
            <div className={styles.left}>
              {props.children}
              {props.canChangeAccount ? (
                <div className={styles.changeAccount}>
                  Use another profile?{' '}
                  <a href="/auth/login" onClick={onChangeAccount}>
                    Return to log in
                  </a>
                </div>
              ) : null}
            </div>
            <div className={`${styles.right} ${isLoadingAvatar ? styles.loading : ''}`}>
              {connectedAccountRef.current && profile !== null ? (
                <>
                  <img src={manDefault} alt="Avatar" className={styles.wearableDefaultImg} />
                  <WearablePreview
                    lockBeta={true}
                    panning={false}
                    disableBackground={true}
                    profile={connectedAccountRef.current}
                    dev={false}
                    onUpdate={handleLoadWearablePreview}
                  />
                  <img src={platformImg} alt="platform" className={styles.wearablePlatform} />
                </>
              ) : null}
            </div>
            <a className={styles.discordBtn} href="https://decentraland.org/discord" target="about:blank">
              <Icon name="discord" />
              <p className={styles.discordInfo}>
                <span>Need guidance?</span>
                <span>MEET THE COMMUNITY</span>
              </p>
            </a>
          </div>
        </div>
      )
    },
    [isLoadingAvatar, view]
  )

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
          <Button inverted disabled={isLoading} onClick={onDenyVerifySignIn} className={styles.noButton}>
            <Icon name="times circle" />
            No, it doesn't
          </Button>
          <Button inverted loading={isLoading} disabled={isLoading} onClick={onApproveSignInVerification} className={styles.yesButton}>
            <Icon name="check circle" />
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
