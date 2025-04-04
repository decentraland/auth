import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const SigningError = ({ error }: { error: React.ReactNode }) => {
  const [targetConfig] = useTargetConfig()
  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>There was an error while trying to submit the request.</div>
      <div className={styles.description}>
        Return to the {targetConfig.explorerText} to try again, or contact support if the error persists.
      </div>
      <CloseWindow />
      <div className={styles.errorMessage}>{error}</div>
    </Container>
  )
}
