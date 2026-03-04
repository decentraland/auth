import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import { ErrorMessageIcon } from './RecoverError.styled'
import styles from './Views.module.css'

export const RecoverError = ({ error }: { error: React.ReactNode }) => (
  <Container>
    <div className={styles.errorLogo}></div>
    <div className={styles.title}>There was an error recovering the request...</div>
    <div className={styles.description}>
      The request is not available anymore. Feel free to create a new one and try again. If the expiration time is still running in the
      Explorer app, check your computer&apos;s time to see if it&apos;s set correctly.
    </div>
    <CloseWindow />
    <div className={styles.errorMessage}>
      <ErrorMessageIcon /> {error}
    </div>
  </Container>
)
