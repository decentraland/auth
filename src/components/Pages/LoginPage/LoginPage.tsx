// import { isElectron } from '../../../integration/desktop'
import { useState, useCallback } from 'react'
import { connection } from 'decentraland-connect'
import { Connection, ConnectionOptionType } from '../../Connection'
import { ConnectionModal, ConnectionModalState } from '../../ConnectionModal'
import { WalletInformationModal } from '../../WalletInformationModal'
import { getSignature, toConnectionOptionToProviderType } from './utils'
import styles from './LoginPage.module.css'

export const LoginPage = () => {
  const [connectionModalState, setConnectionModalState] = useState(ConnectionModalState.CONNECTING_WALLET)
  const [showLearnMore, setShowLearnMore] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const handleLearnMore = useCallback(() => {
    setShowLearnMore(!showLearnMore)
  }, [setShowLearnMore, showLearnMore])

  const handleOnConnect = useCallback(
    async (connectionType: ConnectionOptionType) => {
      setShowConnectionModal(true)
      setConnectionModalState(ConnectionModalState.CONNECTING_WALLET)
      try {
        const providerType = toConnectionOptionToProviderType(connectionType)
        const connectionData = await connection.connect(providerType as any)
        if (!connectionData.account || !connectionData.provider) {
          throw new Error('Could not get provider')
        }
        setConnectionModalState(ConnectionModalState.WAITING_FOR_SIGNATURE)
        await getSignature(connectionData.account?.toLowerCase(), connectionData.provider)
        // Do something after logging in
        setShowConnectionModal(false)
      } catch (error) {
        setConnectionModalState(ConnectionModalState.ERROR)
      }
    },
    [setConnectionModalState, setShowConnectionModal]
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
        <Connection className={styles.connection} onLearnMore={handleLearnMore} onConnect={handleOnConnect} />
      </div>
      <div className={styles.right}>
        {/* {!isElectron() ? ( */}
        <div className={styles.footer}>
          <p>Want better graphics and faster speed?</p>

          <span>
            👉&nbsp;&nbsp;
            <a href="https://decentraland.org/download/" target="_blank" rel="noreferrer">
              <b>Download desktop client</b>
            </a>
          </span>
        </div>
        {/* ) : null} */}
      </div>
    </main>
  )
}
