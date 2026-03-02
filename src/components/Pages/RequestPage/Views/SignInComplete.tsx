import { useTranslation } from '@dcl/hooks'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import styles from './Views.module.css'

export const SignInComplete = () => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()

  return (
    <Container>
      <div className={styles.logo}></div>
      <div className={styles.title}>{t('request_views.sign_in_complete.title')}</div>
      <div className={styles.description}>
        {t('request_views.sign_in_complete.description', { explorerText: targetConfig.explorerText })}
      </div>
      <CloseWindow />
    </Container>
  )
}
