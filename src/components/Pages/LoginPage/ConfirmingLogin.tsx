import { useTranslation } from '@dcl/hooks'
import { CircularProgress, Logo } from 'decentraland-ui2'
import { AnimatedBackground } from '../../AnimatedBackground'
import styles from './ConfirmingLogin.module.css'

export type ConfirmingLoginProps = {
  onError?: () => void
  error?: string | null
}

export const ConfirmingLogin = ({ error, onError }: ConfirmingLoginProps) => {
  const { t } = useTranslation()

  if (error) {
    return (
      <div className={styles.container}>
        <AnimatedBackground variant="absolute" />
        <div className={styles.content}>
          <Logo size="huge" />
          <p className={styles.title}>{t('common.something_went_wrong')}</p>
          <p className={styles.subtitle}>{error}</p>
          {onError && (
            <button className={styles.retryButton} onClick={onError}>
              {t('common.try_again')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <AnimatedBackground variant="absolute" />
      <div className={styles.content}>
        <Logo size="huge" />
        <p className={styles.title}>{t('login.confirming_login')}</p>
        <div className={styles.spinner}>
          <CircularProgress color="inherit" size={40} />
        </div>
      </div>
    </div>
  )
}
