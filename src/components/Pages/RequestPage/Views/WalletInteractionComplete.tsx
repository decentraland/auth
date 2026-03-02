import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const WalletInteractionComplete = () => {
  const { t } = useTranslation()
  return (
    <Container>
      <div className={styles.logo}></div>
      <div className={styles.title}>{t('request_views.wallet_interaction_complete.title')}</div>
      <div className={styles.description}>{t('request_views.wallet_interaction_complete.description')}</div>
      <CloseWindow />
    </Container>
  )
}
