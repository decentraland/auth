import ModalContent from 'semantic-ui-react/dist/commonjs/modules/Modal/ModalContent'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import warningSrc from '../../assets/images/warning.svg'
import { ConnectionModalProps, ConnectionModalState } from './ConnectionModal.types'
import styles from './ConnectionModal.module.css'

export const ConnectionModal = (props: ConnectionModalProps) => {
  const { open, state, onClose, onTryAgain } = props
  const isLoading = state === ConnectionModalState.CONNECTING_WALLET || state === ConnectionModalState.WAITING_FOR_SIGNATURE
  return (
    <Modal size="tiny" open={open}>
      <ModalNavigation title="" onClose={!isLoading ? onClose : undefined} />
      <div className={styles.main}>
        {isLoading ? (
          <div className={styles.content}>
            <Loader className={styles.loader} size="huge" inline />
            <p className={styles.message}>
              {state === ConnectionModalState.CONNECTING_WALLET ? (
                <>
                  To move forward, confirm the connect action in your <b>Wallet</b>.
                </>
              ) : (
                <>
                  To move forward, confirm the signature action in your <b>Wallet</b>.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className={styles.content}>
            <img className={styles.errorImage} src={warningSrc} />
            <p className={styles.message}>
              You rejected the request in your <b>Wallet</b>. To continue, please try again.
            </p>
            <Button primary onClick={onTryAgain}>
              Try again
            </Button>
          </div>
        )}
      </div>
      <ModalContent></ModalContent>
    </Modal>
  )
}
