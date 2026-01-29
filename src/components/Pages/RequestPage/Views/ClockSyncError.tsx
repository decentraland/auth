import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const ClockSyncError = () => (
  <Container>
    <div className={styles.errorLogo}></div>
    <div className={styles.title}>Your device's clock is out of sync</div>
    <div className={styles.description}>
      The authentication request was rejected because your device's date and time settings don't match the server. Please check your date
      and time settings, ensure they're set to update automatically, and try again.
    </div>
    <CloseWindow />
  </Container>
)
