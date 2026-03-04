import { useTranslation } from '@dcl/hooks'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import { ErrorMessageIcon } from './RecoverError.styled'
import styles from './Views.module.css'

export const SigningError = ({ error }: { error: React.ReactNode }) => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()
  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.signing_error.title')}</div>
      <div className={styles.description}>{t('request_views.signing_error.description', { explorerText: targetConfig.explorerText })}</div>
      <CloseWindow />
      <div className={styles.errorMessage}>
        <ErrorMessageIcon fontSize="large" /> {error}
      </div>
    </Container>
  )
}
