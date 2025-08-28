import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import styles from './Views.module.css'

export const DifferentAccountError = ({ requestId }: { requestId: string }) => {
  const [targetConfig] = useTargetConfig()
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>Looks like you are connected with a different account.</div>
      <div className={styles.description}>Please change your wallet account to the one connected to the {targetConfig.explorerText}.</div>
    </Container>
  )
}
