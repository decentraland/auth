import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { TryAgainButton } from './RecoverError.styled'
import styles from './Views.module.css'

type Props = {
  onTryAgain: () => void
}

/**
 * Shown when Decentraland's own RPC could not say whether the request targets a Decentraland
 * contract. Nothing was signed, sent or answered, and the request is still there: Try Again reviews
 * it again on this page rather than sending the user back to the app for a new one.
 */
export const LookupUnavailableError = ({ onTryAgain }: Props) => {
  const { t } = useTranslation()

  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.lookup_unavailable.title')}</div>
      <div className={styles.description}>{t('request_views.lookup_unavailable.description')}</div>
      <TryAgainButton variant="contained" onClick={onTryAgain} data-testid="lookup-unavailable-try-again">
        {t('request_views.lookup_unavailable.try_again')}
      </TryAgainButton>
    </Container>
  )
}
