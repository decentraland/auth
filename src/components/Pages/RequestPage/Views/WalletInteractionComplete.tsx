import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const WalletInteractionComplete = () => {
  return (
    <Container>
      <div className={styles.logo}></div>
      <div className={styles.title}>Wallet interaction complete</div>
      <div className={styles.description}>The action has been executed successfully.</div>
      <CloseWindow />
    </Container>
  )
}
