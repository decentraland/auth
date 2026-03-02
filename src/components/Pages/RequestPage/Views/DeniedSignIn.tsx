import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const DeniedSignIn = ({ requestId }: { requestId: string }) => {
  const { t } = useTranslation()
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.denied_sign_in.title')}</div>
      <div className={styles.description}>{t('request_views.denied_sign_in.description')}</div>
      <CloseWindow />
    </Container>
  )
}
