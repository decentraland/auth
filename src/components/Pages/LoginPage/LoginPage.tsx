import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { Connection, ConnectionOptionType } from '../../Connection'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { MagicInformationModal } from '../../MagicInformationModal'
import { WalletInformationModal } from '../../WalletInformationModal'
import { getSignature, connectToProvider, isSocialLogin, fromConnectionOptionToProviderType } from './utils'
import styles from './LoginPage.module.css'

const BACKGROUND_IMAGES = [Image1, Image2, Image3, Image4, Image5, Image6, Image7, Image8, Image9, Image10]

export const LoginPage = () => {
  const [searchParams] = useSearchParams()
  const [connectionModalState, setConnectionModalState] = useState(ConnectionModalState.CONNECTING_WALLET)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [showMagicLearnMore, setShowMagicLearnMore] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [currentConnectionType, setCurrentConnectionType] = useState<ConnectionOptionType>()
  const redirectTo = useAfterLoginRedirection()
  const showGuestOption = redirectTo && new URL(redirectTo).pathname.includes('/play')
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0)

  const handleLearnMore = useCallback(
    (option?: ConnectionOptionType) => {
      if (option && isSocialLogin(option)) {
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
      setCurrentConnectionType(connectionType)
      if (isSocialLogin(connectionType)) {
        setConnectionModalState(ConnectionModalState.LOADING_MAGIC)
        await connectToProvider(connectionType)
      } else {
        try {
          setShowConnectionModal(true)
          setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)

          // The requests sign in flow for the desktop app has a different identity.
          // There is no need to create one here if the user is coming from the requests page.
          if (searchParams.get('fromRequests') !== 'true') {
            setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
            await getSignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
          }

          if (redirectTo) {
            window.location.href = decodeURIComponent(redirectTo)
          } else {
            window.location.href = '/'
          }
          setShowConnectionModal(false)
        } catch (error) {
          setConnectionModalState(ConnectionModalState.ERROR)
        }
      }
    },
    [setConnectionModalState, setShowConnectionModal, setCurrentConnectionType, redirectTo, searchParams]
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
  }, [currentConnectionType])

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
            socialOptions={{
              primary: ConnectionOptionType.GOOGLE,
              secondary: [ConnectionOptionType.DISCORD, ConnectionOptionType.APPLE, ConnectionOptionType.X]
            }}
            web3Options={{
              primary: ConnectionOptionType.METAMASK,
              secondary: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.COINBASE, ConnectionOptionType.WALLET_CONNECT]
            }}
          />
          {showGuestOption && (
            <div className={styles.guestInfo}>
              Quick dive? <a href={guestRedirectToURL}>Explore as a guest</a>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
