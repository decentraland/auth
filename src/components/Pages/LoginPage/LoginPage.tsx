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
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { useTargetConfig } from '../../../hooks/targetConfig'
import { useAnalytics } from '../../../hooks/useAnalytics'
import { useAuthFlow } from '../../../hooks/useAuthFlow'
import { ClickEvents, ConnectionType } from '../../../modules/analytics/types'
import { config } from '../../../modules/config'
import { createAuthServerHttpClient } from '../../../shared/auth'
import { isErrorWithName } from '../../../shared/errors'
import { extractReferrerFromSearchParameters } from '../../../shared/locations'
import { isClockSynchronized } from '../../../shared/utils/clockSync'
import { handleError } from '../../../shared/utils/errorHandler'
import { ClockSyncModal } from '../../ClockSyncModal'
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
  const [connectionModalState, setConnectionModalState] = useState(ConnectionModalState.CONNECTING_WALLET)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [showMagicLearnMore, setShowMagicLearnMore] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [showClockSyncModal, setShowClockSyncModal] = useState(false)
  const [currentConnectionType, setCurrentConnectionType] = useState<ConnectionOptionType>()
  const { url: redirectTo, redirect } = useAfterLoginRedirection()
  const { initialized: flagInitialized, flags } = useContext(FeatureFlagsContext)
  const showGuestOption = redirectTo && new URL(redirectTo).pathname.includes('/play')
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0)
  const [targetConfig] = useTargetConfig()
  const { checkProfileAndRedirect } = useAuthFlow()
  const { trackClick, trackLoginClick, trackLoginSuccess, trackGuestLogin } = useAnalytics()

  const handleLearnMore = useCallback(
    (option?: ConnectionOptionType) => {
      const isLearningMoreAboutMagic = option && isSocialLogin(option)
      trackClick(ClickEvents.LEARN_MORE, {
        type: isLearningMoreAboutMagic ? 'Learn more about Magic' : 'Learn more about wallets'
      })
      if (isLearningMoreAboutMagic) {
        setShowMagicLearnMore(true)
      } else {
        setShowLearnMore(true)
      }
    },
    [setShowLearnMore, setShowMagicLearnMore, showLearnMore, trackClick]
  )

  const handleCloseLearnMore = useCallback(() => {
    setShowLearnMore(false)
    setShowMagicLearnMore(false)
  }, [setShowLearnMore, setShowMagicLearnMore])

  const handleToggleMagicInfo = useCallback(() => {
    setShowMagicLearnMore(!showMagicLearnMore)
  }, [setShowMagicLearnMore, showMagicLearnMore])

  const handleGuestLogin = useCallback(async () => {
    await trackGuestLogin()
  }, [trackGuestLogin])

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
      if (!flagInitialized) {
        return
      }
      const isLoggingInThroughSocial = isSocialLogin(connectionType)
      const providerType = isLoggingInThroughSocial ? ConnectionType.WEB2 : ConnectionType.WEB3
      setCurrentConnectionType(connectionType)

      trackLoginClick({
        method: connectionType,
        type: providerType
      })

      try {
        if (isLoggingInThroughSocial) {
          setConnectionModalState(ConnectionModalState.LOADING_MAGIC)
          await connectToSocialProvider(connectionType, flags[FeatureFlagsKeys.MAGIC_TEST], redirectTo)
        } else {
          setShowConnectionModal(true)
          setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)

          setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
          await getIdentitySignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)

          await trackLoginSuccess({
            ethAddress: connectionData.account ?? undefined,
            type: providerType
          })

          const search = new URLSearchParams(window.location.search)
          const referrer = extractReferrerFromSearchParameters(search)

          const isClockSync = await checkClockSynchronization()

          if (isClockSync) {
            await checkProfileAndRedirect(connectionData.account ?? '', referrer, () => {
              redirect()
              setShowConnectionModal(false)
            })
          }
        }
      } catch (error) {
        handleError(error, 'Error during login connection', {
          sentryTags: {
            isWeb2Wallet: isLoggingInThroughSocial,
            connectionType
          }
        })

        if (isErrorWithName(error) && error.name === 'ErrorUnlockingWallet') {
          setConnectionModalState(ConnectionModalState.ERROR_LOCKED_WALLET)
        } else {
          setConnectionModalState(ConnectionModalState.ERROR)
        }
      }
    },
    [
      setConnectionModalState,
      setShowConnectionModal,
      setCurrentConnectionType,
      redirectTo,
      flags[FeatureFlagsKeys.MAGIC_TEST],
      trackLoginClick,
      trackLoginSuccess,
      checkProfileAndRedirect,
      redirect,
      flagInitialized
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

  const checkClockSynchronization = useCallback(async (): Promise<boolean> => {
    try {
      const httpClient = createAuthServerHttpClient()
      const healthData = await httpClient.checkHealth()
      const isSync = isClockSynchronized(healthData.timestamp)

      if (!isSync) {
        setShowConnectionModal(false)
        setShowClockSyncModal(true)
        return false
      }

      return true
    } catch (error) {
      handleError(error, 'Error checking clock synchronization')
      // If we can't check the clock, proceed with normal flow
      return true
    }
  }, [])

  const handleClockSyncContinue = useCallback(async () => {
    setShowClockSyncModal(false)

    // Get the current connection data and proceed with profile check
    if (currentConnectionType) {
      try {
        const connectionData = await connectToProvider(currentConnectionType)
        const search = new URLSearchParams(window.location.search)
        const referrer = extractReferrerFromSearchParameters(search)

        await checkProfileAndRedirect(connectionData.account ?? '', referrer, () => {
          redirect()
          setShowConnectionModal(false)
        })
      } catch (error) {
        handleError(error, 'Error during clock sync continue flow')
      }
    }
  }, [currentConnectionType, checkProfileAndRedirect, redirect])

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
      {config.is(Env.DEVELOPMENT) && !flagInitialized ? (
        <Loader active size="massive" />
      ) : (
        <>
          <WalletInformationModal open={showLearnMore} onClose={handleCloseLearnMore} />
          <MagicInformationModal open={showMagicLearnMore} onClose={handleToggleMagicInfo} />
          <ClockSyncModal open={showClockSyncModal} onContinue={handleClockSyncContinue} onClose={handleClockSyncContinue} />
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
