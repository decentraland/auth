import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const SignInComplete = () => {
  const [targetConfig] = useTargetConfig()

  return (
    <Container>
      <div className={styles.logo}></div>
      <div className={styles.title}>Your account is ready!</div>
      <div className={styles.description}>Return to the {targetConfig.explorerText} and enjoy Decentraland.</div>
      <CloseWindow />
    </Container>
  )
}
