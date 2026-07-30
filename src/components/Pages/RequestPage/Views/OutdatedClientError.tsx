import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import styles from './Views.module.css'

type Props = {
  explorerText?: string
}

// Shown when a request arrives on the retired dcl_personal_sign sign-in: the client is too old to
// use the identity handoff. Deliberately offers no retry — re-running the same request would be
// rejected again — so the only way forward is updating the app.
export const OutdatedClientError = ({ explorerText }: Props) => {
  const { t } = useTranslation()

  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title} data-testid="outdated-client-error">
        {t('request_views.outdated_client_error.title')}
      </div>
      <div className={styles.description}>
        {t('request_views.outdated_client_error.description', { explorerText: explorerText ?? 'Decentraland' })}
      </div>
    </Container>
  )
}
