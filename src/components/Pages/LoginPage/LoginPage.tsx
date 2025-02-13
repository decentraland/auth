import { useState, useCallback, useMemo, useEffect, useContext } from 'react'
import { Env } from '@dcl/ui-env'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import Image1 from '../../../assets/images/background/image1.webp'
import Image10 from '../../../assets/images/background/image10.webp'
import Image2 from '../../../assets/images/background/image2.webp'
import Image3 from '../../../assets/images/background/image3.webp'
import Image4 from '../../../assets/images/background/image4.webp'
import Image5 from '../../../assets/images/background/image5.webp'
import Image6 from '../../../assets/images/background/image6.webp'
import Image7 from '../../../assets/images/background/image7.webp'
import Image8 from '../../../assets/images/background/image8.webp'
import Image9 from '../../../assets/images/background/image9.webp'
import { useNavigateWithSearchParams } from '../../../hooks/navigation'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import usePageTracking from '../../../hooks/usePageTracking'
import { getAnalytics } from '../../../modules/analytics/segment'
import { ClickEvents, ConnectionType, TrackingEvents } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { fetchProfile } from '../../../modules/profile'
import { isErrorWithMessage, isErrorWithName } from '../../../shared/errors'
import { locations } from '../../../shared/locations'
import { wait } from '../../../shared/time'
import { Connection, ConnectionOptionType } from '../../Connection'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { FeatureFlagsContext, FeatureFlagsKeys } from '../../FeatureFlagsProvider'
import { MagicInformationModal } from '../../MagicInformationModal'
import { WalletInformationModal } from '../../WalletInformationModal'
import {
  getIdentitySignature,
  connectToProvider,
  isSocialLogin,
  fromConnectionOptionToProviderType,
  connectToSocialProvider
} from './utils'
import styles from './LoginPage.module.css'

const BACKGROUND_IMAGES = [Image1, Image2, Image3, Image4, Image5, Image6, Image7, Image8, Image9, Image10]

export const LoginPage = () => {
  usePageTracking()
  const navigate = useNavigateWithSearchParams()
  const [connectionModalState, setConnectionModalState] = useState(ConnectionModalState.CONNECTING_WALLET)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [showMagicLearnMore, setShowMagicLearnMore] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [currentConnectionType, setCurrentConnectionType] = useState<ConnectionOptionType>()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { flags, initialized } = useContext(FeatureFlagsContext)
  const showGuestOption = redirectTo && new URL(redirectTo).pathname.includes('/play')
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0)
  const [targetConfig] = useTargetConfig()

  const handleLearnMore = useCallback(
    (option?: ConnectionOptionType) => {
      const isLearningMoreAboutMagic = option && isSocialLogin(option)
      getAnalytics()?.track(TrackingEvents.CLICK, {
        action: ClickEvents.LEARN_MORE,
        type: isLearningMoreAboutMagic ? 'Learn more about Magic' : 'Learn more about wallets'
      })
      if (isLearningMoreAboutMagic) {
        setShowMagicLearnMore(true)
      } else {
        setShowLearnMore(true)
      }
    },
    [setShowLearnMore, setShowMagicLearnMore, showLearnMore]
  )

  const handleCloseLearnMore = useCallback(() => {
    setShowLearnMore(false)
    setShowMagicLearnMore(false)
  }, [setShowLearnMore, setShowMagicLearnMore])

  const handleToggleMagicInfo = useCallback(() => {
    setShowMagicLearnMore(!showMagicLearnMore)
  }, [setShowMagicLearnMore, showMagicLearnMore])

  const handleGuestLogin = useCallback(async () => {
    // Wait 800 ms for the tracking to be completed
    getAnalytics()?.track(TrackingEvents.LOGIN_CLICK, { type: 'guest' })
    await wait(800)
  }, [])

  const guestRedirectToURL = useMemo(() => {
    if (redirectTo) {
      const playUrl = new URL(redirectTo)
      playUrl.searchParams.append('guest', 'true')
      return playUrl.toString()
    }
    return ''
  }, [redirectTo])

  const handleOnConnect = useCallback(
    async (connectionType: ConnectionOptionType) => {
      const isLoggingInThroughSocial = isSocialLogin(connectionType)
      const providerType = isLoggingInThroughSocial ? ConnectionType.WEB2 : ConnectionType.WEB3
      setCurrentConnectionType(connectionType)
      getAnalytics()?.track(TrackingEvents.LOGIN_CLICK, {
        method: connectionType,
        type: providerType
      })
      if (isLoggingInThroughSocial) {
        setConnectionModalState(ConnectionModalState.LOADING_MAGIC)
        // Wait 800 ms for the tracking to be completed
        await wait(800)
        await connectToSocialProvider(connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo)
      } else {
        try {
          setShowConnectionModal(true)
          setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)

          // Wait a second after the connection is established so there is no race condition between the readiness
          // of the connection and the signature being requested.
          // This is necessary for Wallet Connect.
          await wait(800)

          setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
          await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)

          getAnalytics()?.track(TrackingEvents.LOGIN_SUCCESS, {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            eth_address: connectionData.account,
            type: providerType
          })
          getAnalytics()?.identify({ ethAddress: connectionData.account })
          // Wait 800 ms for the tracking to be completed
          await wait(800)

          // If the flag is enabled and the setup is not skipped by config, proceed with the simplified avatar setup flow.
          if (!targetConfig.skipSetup) {
            // Can only proceed if the connection data has an account. Without the account the profile cannot be fetched.
            // Continues with the original flow if the account is not present.
            if (connectionData.account) {
              const profile = await fetchProfile(connectionData.account)

              // If the connected account does not have a profile, redirect the user to the setup page to create a new one.
              // The setup page should then redirect the user to the url provided as query param if available.
              if (!profile) {
                navigate(locations.setup(redirectTo))
                return setShowConnectionModal(false)
              }
            }
          }

          redirect()
          setShowConnectionModal(false)
        } catch (error) {
          console.error('Error', isErrorWithMessage(error) ? error.message : JSON.stringify(error))
          getAnalytics()?.track(TrackingEvents.LOGIN_ERROR, { error: isErrorWithMessage(error) ? error.message : error })
          if (isErrorWithName(error) && error.name === 'ErrorUnlockingWallet') {
            setConnectionModalState(ConnectionModalState.ERROR_LOCKED_WALLET)
          } else {
            setConnectionModalState(ConnectionModalState.ERROR)
          }
        }
      }
    },
    [
      setConnectionModalState,
      setShowConnectionModal,
      setCurrentConnectionType,
      redirectTo,
      flags[FeatureFlagsKeys.MAGIC_TEST],
      navigate,
      redirect
    ]
  )

  const handleOnCloseConnectionModal = useCallback(() => {
    setShowConnectionModal(false)
    setCurrentConnectionType(undefined)
    setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
  }, [setShowConnectionModal])

  const handleTryAgain = useCallback(() => {
    if (currentConnectionType) {
      handleOnConnect(currentConnectionType)
    }
  }, [currentConnectionType, handleOnConnect])

  useEffect(() => {
    const backgroundInterval = setInterval(() => {
      setCurrentBackgroundIndex(index => {
        if (index === BACKGROUND_IMAGES.length - 1) {
          return 0
        }
        return index + 1
      })
    }, 5000)
    return () => {
      clearInterval(backgroundInterval)
    }
  }, [])

  return (
    <main className={styles.main}>
      <div className={styles.background} style={{ backgroundImage: `url(${BACKGROUND_IMAGES[currentBackgroundIndex]})` }} />
      {config.is(Env.DEVELOPMENT) && !initialized ? (
        <Loader active size="massive" />
      ) : (
        <>
          <WalletInformationModal open={showLearnMore} onClose={handleCloseLearnMore} />
          <MagicInformationModal open={showMagicLearnMore} onClose={handleToggleMagicInfo} />
          <ConnectionModal
            open={showConnectionModal}
            state={connectionModalState}
            onClose={handleOnCloseConnectionModal}
            onTryAgain={handleTryAgain}
            providerType={currentConnectionType ? fromConnectionOptionToProviderType(currentConnectionType) : null}
          />
          <div className={styles.left}>
            <div className={styles.leftInfo}>
              <Connection
                onLearnMore={handleLearnMore}
                onConnect={handleOnConnect}
                loadingOption={currentConnectionType}
                connectionOptions={targetConfig.connectionOptions}
              />
              {showGuestOption && (
                <div className={styles.guestInfo}>
                  Quick dive?{' '}
                  <a href={guestRedirectToURL} onClick={handleGuestLogin}>
                    Explore as a guest
                  </a>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
