// import { isElectron } from '../../../integration/desktop'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAfterLoginRedirection } from '../../../hooks/redirection'
import { Connection, ConnectionOptionType } from '../../Connection'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { WalletInformationModal } from '../../WalletInformationModal'
import { getSignature, connectToProvider, isSocialLogin } from './utils'
import styles from './LoginPage.module.css'

export const LoginPage = () => {
  const [connectionModalState, setConnectionModalState] = useState(ConnectionModalState.CONNECTING_WALLET)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const redirectTo = useAfterLoginRedirection()
  const navigate = useNavigate()

  const handleLearnMore = useCallback(() => {
    setShowLearnMore(!showLearnMore)
  }, [setShowLearnMore, showLearnMore])

  const handleOnConnect = useCallback(
    async (connectionType: ConnectionOptionType) => {
      setShowConnectionModal(true)
      if (isSocialLogin(connectionType)) {
        setConnectionModalState(ConnectionModalState.LOADING_MAGIC)
        await connectToProvider(connectionType)
      } else {
        try {
          setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
          const connectionData = await connectToProvider(connectionType)
          setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
          await getSignature(connectionData.account?.toLowerCase() ?? '', connectionData.provider)
          if (redirectTo) {
            window.location.href = redirectTo
          } else {
            navigate('/user')
          }
          setShowConnectionModal(false)
        } catch (error) {
          setConnectionModalState(ConnectionModalState.ERROR)
        }
      }
    },
    [setConnectionModalState, setShowConnectionModal, redirectTo]
  )

  const handleOnCloseConnectionModal = useCallback(() => {
    setShowConnectionModal(false)
    setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
  }, [setShowConnectionModal])

  return (
    <main className={styles.main}>
      <WalletInformationModal open={showLearnMore} onClose={handleLearnMore} />
      <ConnectionModal
        open={showConnectionModal}
        state={connectionModalState}
        onClose={handleOnCloseConnectionModal}
        onTryAgain={() => console.log('On try again')}
      />

      <div className={styles.left}>
        <Connection
          className={styles.connection}
          onLearnMore={handleLearnMore}
          onConnect={handleOnConnect}
          socialOptions={{
            primary: ConnectionOptionType.GOOGLE,
            secondary: [ConnectionOptionType.DISCORD, ConnectionOptionType.APPLE, ConnectionOptionType.X]
          }}
          web3Options={{
            primary: ConnectionOptionType.METAMASK,
            secondary: [ConnectionOptionType.FORTMATIC, ConnectionOptionType.COINBASE, ConnectionOptionType.WALLET_CONNECT]
          }}
        />
      </div>
    </main>
  )
}
