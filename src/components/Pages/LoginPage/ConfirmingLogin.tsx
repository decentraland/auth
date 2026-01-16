import { Logo, CircularProgress } from 'decentraland-ui2'
import styles from './ConfirmingLogin.module.css'

export type ConfirmingLoginProps = {
  onError?: () => void
  error?: string | null
}

export const ConfirmingLogin = ({ error, onError }: ConfirmingLoginProps) => {
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.background} />
        <div className={styles.content}>
          <Logo size="huge" />
          <p className={styles.title}>Something went wrong</p>
          <p className={styles.subtitle}>{error}</p>
          {onError && (
            <button className={styles.retryButton} onClick={onError}>
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      <div className={styles.content}>
        <Logo size="huge" />
        <p className={styles.title}>Confirming login...</p>
        <div className={styles.spinner}>
          <CircularProgress color="inherit" size={40} />
        </div>
      </div>
    </div>
  )
}
