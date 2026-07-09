import { ReactNode } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { ErrorMessageIcon, TryAgainButton } from './RecoverError.styled'
import styles from './Views.module.css'

type Props = {
  error?: ReactNode
  onTryAgain: () => void
}

// Error view for the client-login pseudo request: unlike RecoverError, its copy is about
// completing the sign in (there is no auth-server request to recover) and Try Again
// re-runs the identity post rather than firing a bare deep link.
export const ClientLoginError = ({ error, onTryAgain }: Props) => {
  const { t } = useTranslation()

  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.client_login_error.title')}</div>
      <div className={styles.description}>{t('request_views.client_login_error.description')}</div>
      <TryAgainButton variant="contained" onClick={onTryAgain} data-testid="client-login-error-try-again-button">
        {t('common.try_again')}
      </TryAgainButton>
      {error ? (
        <div className={styles.errorMessage}>
          <ErrorMessageIcon fontSize="large" /> {error}
        </div>
      ) : null}
    </Container>
  )
}
