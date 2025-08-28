import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const DeniedWalletInteraction = () => {
  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>Was this action not initiated by you?</div>
      <div className={styles.description}>If this action was not initiated by you, dismiss this message.</div>
      <CloseWindow />
    </Container>
  )
}
