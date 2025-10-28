import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const IpValidationError = ({ requestId, reason }: { requestId: string; reason: string }) => {
  return (
    <Container requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>Security Validation Failed</div>
      <div className={styles.description}>
        This confirmation request was created from a different device or network. For security reasons, you can only complete this request
        from the same device where it was originally initiated.
      </div>
      <CloseWindow />
      <div className={styles.errorMessage}>
        <ErrorOutlineIcon fontSize="large" sx={{ color: '#fb3b3b' }} />
        <div>
          <strong>Request ID:</strong> {requestId}
          <br />
          <strong>Reason:</strong> {reason}
        </div>
      </div>
    </Container>
  )
}
