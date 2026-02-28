import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const DeniedWalletInteraction = () => {
  const { t } = useTranslation()
  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.denied_wallet_interaction.title')}</div>
      <div className={styles.description}>{t('request_views.denied_wallet_interaction.description')}</div>
      <CloseWindow />
    </Container>
  )
}
