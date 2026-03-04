import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const DeniedSignIn = ({ requestId }: { requestId: string }) => {
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>Did the number not match, or was this action not taken by you?</div>
      <div className={styles.description}>
        If you're trying to sign in, retry the action. If this action was not initiated by you, dismiss this message.
      </div>
      <CloseWindow />
    </Container>
  )
}
