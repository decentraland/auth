import ModalContent from 'semantic-ui-react/dist/commonjs/modules/Modal/ModalContent'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import warningSrc from '../../assets/images/warning.svg'
import { getConnectionMessage } from './utils'
import { ConnectionModalProps, ConnectionModalState } from './ConnectionModal.types'
import styles from './ConnectionModal.module.css'

export const ConnectionModal = (props: ConnectionModalProps) => {
  const { open, state, onClose, onTryAgain } = props
  const isLoading =
    state === ConnectionModalState.CONNECTING_WALLET ||
    state === ConnectionModalState.WAITING_FOR_SIGNATURE ||
    ConnectionModalState.LOADING_MAGIC
  return (
    <Modal size="tiny" open={open}>
      <ModalNavigation title="" onClose={!isLoading ? onClose : undefined} />
      <div className={styles.main}>
        <div className={styles.content}>
          {state === ConnectionModalState.ERROR && <img className={styles.errorImage} src={warningSrc} />}
          {isLoading && <Loader className={styles.loader} size="huge" inline />}
          <p className={styles.message}>{getConnectionMessage(state)}</p>
          {state === ConnectionModalState.ERROR && (
            <Button primary onClick={onTryAgain}>
              Try again
            </Button>
          )}
        </div>
      </div>
      <ModalContent></ModalContent>
    </Modal>
  )
}
