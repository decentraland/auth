import { useTranslation } from '@dcl/hooks'
import { Container } from '../Container'
import { TryAgainButton } from './RecoverError.styled'
import styles from './Views.module.css'

type Props = {
  onTryAgain: () => void
}

export const RecoverError = ({ onTryAgain }: Props) => {
  const { t } = useTranslation()

  return (
    <Container>
      <div className={styles.errorLogo}></div>
      <div className={styles.title}>{t('request_views.recover_error.title')}</div>
      <div className={styles.description}>{t('request_views.recover_error.description')}</div>
      <TryAgainButton variant="contained" onClick={onTryAgain}>
        {t('request_views.recover_error.try_again')}
      </TryAgainButton>
    </Container>
  )
}
