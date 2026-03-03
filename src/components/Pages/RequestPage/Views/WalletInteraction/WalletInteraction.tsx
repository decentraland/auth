import { useTranslation } from '@dcl/hooks'
import { Box, Button, CircularProgress } from 'decentraland-ui2'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'

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
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>
        {isWeb2Wallet ? t('request.wallet_interaction.title_web2') : t('request.wallet_interaction.title_web3', { explorerText })}
      </Box>
      <Box className={styles.description}>{t('request.wallet_interaction.description')}</Box>
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
