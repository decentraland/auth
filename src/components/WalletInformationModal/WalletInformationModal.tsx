import classNames from 'classnames'
import ModalContent from 'semantic-ui-react/dist/commonjs/modules/Modal/ModalContent'
import { Button } from 'decentraland-ui/dist/components/Button/Button'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import { WalletInformationModalProps } from './WalletInformationModal.types'
import styles from './WalletInformationModal.module.css'

const defaultProps = {
  i18n: {
    title: 'What is a digital wallet?',
    assets: {
      title: 'A Home For Your Digital Assets',
      text: 'Wallets are used to send, receive, store, and display digital assets, such as your Decentraland Wearables, NAMEs, LANDs, etc.'
    },
    logIn: {
      title: 'A New Way To Log In',
      text: 'Instead of creating new accounts and passwords on every website, in the world of Web3 all you need to do is just connect your digital wallet.'
    },
    goBack: 'Return to log in page'
  }
}

export const WalletInformationModal = (props: WalletInformationModalProps) => {
  const { i18n = defaultProps.i18n, onClose, open } = props
  return (
    <Modal size="tiny" open={open} className={styles.infoModal} onClose={onClose}>
      <ModalNavigation title="" onClose={onClose} />
      <ModalContent className={styles.infoContent}>
        <div className={styles.main}>
          <h1 className={styles.title}>{i18n?.title}</h1>
          <article className={styles.info}>
            <div className={classNames(styles.infoImage, styles.assets)} />
            <h3>{i18n?.assets.title}</h3>
            <p>{i18n?.assets.text}</p>
          </article>
          <article className={styles.info}>
            <div className={classNames(styles.infoImage, styles.login)} />
            <h3>{i18n?.logIn.title}</h3>
            <p>{i18n?.logIn.text}</p>
          </article>
          <Button className={styles.goBackButton} secondary inverted onClick={onClose}>
            {i18n?.goBack}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}
