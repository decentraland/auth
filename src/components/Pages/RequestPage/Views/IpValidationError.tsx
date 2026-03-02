import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import { ErrorMessageIcon } from './RecoverError.styled'
import styles from './Views.module.css'

export const IpValidationError = ({ requestId, reason }: { requestId: string; reason: string }) => {
  const { t } = useTranslation()
  return (
    <Container requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.ip_validation_error.title')}</div>
      <div className={styles.description}>{t('request_views.ip_validation_error.description')}</div>
      <CloseWindow />
      <div className={styles.errorMessage}>
        <ErrorMessageIcon fontSize="large" />
        <div>
          <strong>{t('request_views.ip_validation_error.request_id')}</strong> {requestId}
          <br />
          <strong>{t('request_views.ip_validation_error.reason')}</strong> {reason}
        </div>
      </div>
    </Container>
  )
}
