import { useCallback } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { TryAgainButton } from './RecoverError.styled'
import styles from './Views.module.css'

const EXPLORER_DEEPLINK = 'decentraland://'

export const RecoverError = () => {
  const { t } = useTranslation()

  const handleTryAgain = useCallback(() => {
    window.location.href = EXPLORER_DEEPLINK
  }, [])

  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.recover_error.title')}</div>
      <div className={styles.description}>{t('request_views.recover_error.description')}</div>
      <TryAgainButton variant="contained" onClick={handleTryAgain}>
        {t('request_views.recover_error.try_again')}
      </TryAgainButton>
    </Container>
  )
}
