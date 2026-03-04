import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import { ErrorMessageIcon } from './RecoverError.styled'
import styles from './Views.module.css'

export const RecoverError = ({ error }: { error: React.ReactNode }) => {
  const { t } = useTranslation()
  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.recover_error.title')}</div>
      <div className={styles.description}>{t('request_views.recover_error.description')}</div>
      <CloseWindow />
      <div className={styles.errorMessage}>
        <ErrorMessageIcon /> {error}
      </div>
    </Container>
  )
}
