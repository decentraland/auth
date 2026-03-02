import { useTranslation } from '@dcl/hooks'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const TimeoutError = ({ requestId }: { requestId: string }) => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()
  return (
    <Container requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.timeout.title')}</div>
      <div className={styles.subtitle}>{t('request_views.timeout.subtitle')}</div>
      <div className={styles.description}>{t('request_views.timeout.description', { explorerText: targetConfig.explorerText })}</div>
      <CloseWindow />
    </Container>
  )
}
