import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const TimeoutError = ({ requestId }: { requestId: string }) => {
  const [targetConfig] = useTargetConfig()
  return (
    <Container requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>
        Looks like you took too long and the request has expired. If the expiration time is still running in the Explorer app, check your
        computer's time to see if it's set correctly
      </div>
      <div className={styles.description}>Please return to Decentraland's {targetConfig.explorerText} to try again.</div>
      <CloseWindow />
    </Container>
  )
}
