import { useTranslation } from '@dcl/hooks'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import styles from './Views.module.css'

export const DifferentAccountError = ({ requestId }: { requestId: string }) => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.different_account.title')}</div>
      <div className={styles.description}>{t('request_views.different_account.description', { explorerText: targetConfig.explorerText })}</div>
    </Container>
  )
}
