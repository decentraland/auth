/* eslint-disable @typescript-eslint/naming-convention */
import ModalContent from 'semantic-ui-react/dist/commonjs/modules/Modal/ModalContent'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import { MagicInformationModalProps } from './MagicInformationModal.types'
import styles from './MagicInformationModal.module.css'

const defaultProps = {
  i18n: {
    title: 'How does Magic work?',
    subtitle:
      "Magic handles digital wallet creation & management behind the scenes so you don't have to. Just log into Decentraland with your favorite social account and let Magic handle the rest.<br /> <br />If you'd rather take a more hands-on approach to your digital asset storage (e.g. Wearables, NAMEs, etc.), get a digital wallet from a provider such as MetaMask and use it to create your Decentraland account.",
    goBack: 'Return to log in page'
  }
}

export const MagicInformationModal = (props: MagicInformationModalProps) => {
  const { i18n = defaultProps.i18n, onClose, open } = props
  return (
    <Modal size="tiny" open={open} className={styles.infoModal} onClose={onClose}>
      <ModalNavigation title="" onClose={onClose} />
      <ModalContent className={styles.infoContent}>
        <div className={styles.main}>
          <h1 className={styles.title}>{i18n?.title}</h1>
          <span className={styles.info} dangerouslySetInnerHTML={{ __html: i18n?.subtitle }} />
          <Button className={styles.goBackButton} secondary inverted onClick={onClose}>
            {i18n?.goBack}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}
