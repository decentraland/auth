import classNames from 'classnames'
import ModalContent from 'semantic-ui-react/dist/commonjs/modules/Modal/ModalContent'
import { Modal } from 'decentraland-ui/dist/components/Modal/Modal'
import { ModalNavigation } from 'decentraland-ui/dist/components/ModalNavigation/ModalNavigation'
import { WalletInformationModalProps } from './WalletInformationModal.types'
import styles from './WalletInformationModal.module.css'

const defaultProps = {
  i18n: {
    title: "What's a wallet?",
    assets: {
      title: 'A home for your digital assets',
      text: 'Wallets are used to send, receive, store, and display digital assets like Ethereum and NFTs.'
    },
    logIn: {
      title: 'A New Way To Log In',
      text: 'Instead of creating new accounts and passwords on every website, just connect your wallet.'
    }
  }
}

export const WalletInformationModal = (props: WalletInformationModalProps) => {
  const { i18n = defaultProps.i18n, onClose, open } = props
  return (
    <Modal size="tiny" open={open}>
      <ModalNavigation title="" onClose={onClose} />
      <ModalContent>
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
        </div>
      </ModalContent>
    </Modal>
  )
}
