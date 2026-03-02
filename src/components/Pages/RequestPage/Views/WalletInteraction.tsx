import { useTranslation } from '@dcl/hooks'
import { Button, CircularProgress } from 'decentraland-ui2'
import { Container } from '../Container'
import { ButtonsContainer } from '../RequestPage.styled'
import styles from './Views.module.css'

interface WalletInteractionProps {
  requestId: string
  isWeb2Wallet?: boolean
  explorerText?: string
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}

export const WalletInteraction = ({
  requestId,
  isWeb2Wallet = false,
  explorerText = 'Explorer',
  isLoading = false,
  onDeny,
  onApprove
}: WalletInteractionProps) => {
  const { t } = useTranslation()
  return (
    <Container canChangeAccount requestId={requestId}>
      <div className={styles.logo}></div>
      <div className={styles.title}>
        {isWeb2Wallet ? t('request.wallet_interaction.title_web2') : t('request.wallet_interaction.title_web3', { explorerText })}
      </div>
      <div className={styles.description}>{t('request.wallet_interaction.description')}</div>
      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny}>
          {t('common.deny')}
        </Button>
        <Button variant="contained" disabled={isLoading} onClick={onApprove}>
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
