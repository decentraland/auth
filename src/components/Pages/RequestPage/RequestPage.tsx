import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ethers, BrowserProvider } from 'ethers'
import Icon from 'semantic-ui-react/dist/commonjs/elements/Icon/Icon'
import { io } from 'socket.io-client'
import { Profile } from '@dcl/schemas'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { CommunityBubble } from 'decentraland-ui/dist/components/CommunityBubble'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { connection } from 'decentraland-connect'
import { useTargetConfig } from '../../../hooks/targetConfig'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, TrackingEvents } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { fetchProfile } from '../../../modules/profile'
import { isErrorWithMessage, isRpcError } from '../../../shared/errors'
import { CustomWearablePreview } from '../../CustomWearablePreview'
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
  const params = useParams()
  const navigate = useNavigate()
  const providerRef = useRef<BrowserProvider>()
  const [view, setView] = useState(View.LOADING_REQUEST)
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>()
  // TODO: Add a type for the request.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestRef = useRef<any>()
  const [error, setError] = useState<string>()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const connectedAccountRef = useRef<string>()
  const requestId = params.requestId ?? ''
  const [targetConfig, targetConfigId] = useTargetConfig()

  // Goes to the login page where the user will have to connect a wallet.
  const toLoginPage = useCallback(() => {
    navigate(`/login?redirectTo=${encodeURIComponent(`/auth/requests/${requestId}?targetConfigId=${targetConfigId}`)}`)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        // Try to restablish connection with the wallet.
        const connectionData = await connection.tryPreviousConnection()
        providerRef.current = new ethers.BrowserProvider(connectionData.provider)

        // Goes to the login page if no account is returned in the data.
        if (!connectionData.account) {
          throw new Error('No account connected')
        }

        const profile = await fetchProfile(connectionData.account)

        // `alternative` has its own set up
        if (!targetConfig.skipSetup) {
          // Goes to the setup page if the connected account does not have a profile yet.
          if (!profile) {
            navigate(`/setup?redirectTo=/auth/requests/${requestId}`)
            return
          }
        }
      } catch (e) {
        toLoginPage()
        return
      }

      try {
        const signer = await providerRef.current.getSigner()
        const signerAddress = await signer.getAddress()
        getAnalytics().identify({ ethAddress: signerAddress })
        // Recover the request from the auth server.
        const request = await authServerFetch('recover', { requestId })
        requestRef.current = request
        const profile = await fetchProfile(signerAddress)
        setProfile(profile)

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

  const onDenyVerifySignIn = useCallback(async () => {
    setIsLoading(true)
    getAnalytics().track(TrackingEvents.CLICK, {
      action: ClickEvents.DENY_SIGN_IN
    })
    try {
      const signer = await providerRef.current?.getSigner()
      if (signer) {
        await authServerFetch('outcome', {
          requestId,
          sender: await signer.getAddress(),
          error: { code: -32003, message: 'Transaction rejected' }
        })
      }
    } finally {
      setIsLoading(false)
      setView(View.VERIFY_SIGN_IN_DENIED)
    }
  }, [])

  const onApproveSignInVerification = useCallback(async () => {
    getAnalytics().track(TrackingEvents.CLICK, {
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
  }, [setIsLoading])

  const onDenyWalletInteraction = useCallback(() => {
    getAnalytics().track(TrackingEvents.CLICK, {
      action: ClickEvents.DENY_WALLET_INTERACTION
    })
    setView(View.WALLET_INTERACTION_DENIED)
  }, [])

  const onApproveWalletInteraction = useCallback(async () => {
    setIsLoading(true)
    const provider = providerRef.current
    try {
      if (!provider) {
        throw new Error('Provider not created')
      }

      const signer = await provider.getSigner()
      const result = await provider.send(requestRef.current.method, requestRef.current.params)
      getAnalytics().track(TrackingEvents.CLICK, {
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
      console.error('Wallet error', JSON.stringify(e))
      const signer = await providerRef.current?.getSigner()
      if (signer) {
        if (isRpcError(e)) {
          await authServerFetch('outcome', {
            requestId,
            sender: await signer.getAddress(),
            error: e.error
          })
        } else {
          await authServerFetch('outcome', {
            requestId,
            sender: await signer.getAddress(),
            error: { code: 999, message: isErrorWithMessage(e) ? e.message : 'Unknown error' }
          })
        }
      }
      setError(isErrorWithMessage(e) ? e.message : 'Unknown error')
      setView(View.WALLET_INTERACTION_ERROR)
    }
  }, [])

  const onChangeAccount = useCallback(async evt => {
    evt.preventDefault()
    await connection.disconnect()
    toLoginPage()
  }, [])

  const Container = useCallback(
    (props: { children: ReactNode; canChangeAccount?: boolean; isLoading?: boolean }) => {
      if (!targetConfig.showWearablePreview) {
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
              <CommunityBubble className={styles.communityBubble} />
            </div>
          </div>
        )
      }

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
            <div className={styles.right}>
              {connectedAccountRef.current && profile !== null ? <CustomWearablePreview profile={connectedAccountRef.current} /> : null}
            </div>
            <CommunityBubble className={styles.communityBubble} />
          </div>
        </div>
      )
    },
    [view]
  )

  if (view === View.TIMEOUT) {
    return (
      <Container>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>Looks like you took too long and the request has expired</div>
        <div className={styles.description}>Please return to Decentraland's {targetConfig.explorerText} to try again.</div>
        <CloseWindow />
      </Container>
    )
  }

  if (view === View.DIFFERENT_ACCOUNT) {
    return (
      <Container canChangeAccount>
        <div className={styles.errorLogo}></div>
        <div className={styles.title}>Looks like you are connected with a different account.</div>
        <div className={styles.description}>Please change your wallet account to the one connected to the {targetConfig.explorerText}.</div>
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
        <div className={styles.description}>Do you see the same verification number on your {targetConfig.explorerText}?</div>
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
        <div className={styles.description}>Return to the {targetConfig.explorerText} and enjoy Decentraland.</div>
        <CloseWindow />
      </Container>
    )
  }

  // Wallet Interaction

  if (view === View.WALLET_INTERACTION && requestRef.current) {
    return (
      <Container canChangeAccount isLoading={isLoading}>
        <div className={styles.logo}></div>
        <div className={styles.title}>The {targetConfig.explorerText} wants to interact with your wallet.</div>
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
        <div className={styles.description}>
          Return to the {targetConfig.explorerText} to try again, or contact support if the error persists.
        </div>
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
