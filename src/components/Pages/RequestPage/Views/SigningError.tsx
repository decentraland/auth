import { useTranslation } from '@dcl/hooks'
import { useTargetConfig } from '../../../../hooks/targetConfig'
import { Container } from '../Container'
import { CloseWindow } from './CloseWindow'
import { ErrorMessageIcon } from './RecoverError.styled'
import styles from './Views.module.css'

/**
 * Why a request ended on the signing error view, in terms the user reads translated. The exact
 * reason stays in `error`, in English, for the developer of the requesting scene: it is the same
 * text the request was answered with.
 */
type SigningErrorKind = 'malformed_transaction' | 'malformed_signature' | 'impersonated_sign_in' | 'wallet_error'

type Props = {
  error: React.ReactNode
  kind?: SigningErrorKind
}

export const SigningError = ({ error, kind = 'wallet_error' }: Props) => {
  const { t } = useTranslation()
  const [targetConfig] = useTargetConfig()
  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.signing_error.title')}</div>
      <div className={styles.description} data-testid="signing-error-explanation">
        {t(`request_views.signing_error.${kind}`)}
      </div>
      <div className={styles.description}>{t('request_views.signing_error.description', { explorerText: targetConfig.explorerText })}</div>
      <CloseWindow />
      <div className={styles.errorMessage}>
        <ErrorMessageIcon fontSize="large" /> {t('request_views.signing_error.details')} {error}
      </div>
    </Container>
  )
}

export type { SigningErrorKind }
