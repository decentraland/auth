import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const SignInComplete = () => {
  const [targetConfig] = useTargetConfig()

  return (
    <Container>
      <div className={styles.logo}></div>
      <div className={styles.title}>Login Successful!</div>
      <div className={styles.description}>Return to the {targetConfig.explorerText} to jump in!</div>
      <CloseWindow />
    </Container>
  )
}
