import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

/** An existing server answer does not establish whether a wallet action succeeded or was canceled. */
export const RequestAlreadyAnswered = () => {
  const { t } = useTranslation()
  return (
    <Container>
      <div className={styles.logo}></div>
      <div className={styles.title}>{t('request_views.request_already_answered.title')}</div>
      <div className={styles.description}>{t('request_views.request_already_answered.description')}</div>
      <CloseWindow />
    </Container>
  )
}
