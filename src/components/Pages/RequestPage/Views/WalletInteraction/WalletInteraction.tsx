import { useTranslation } from '@dcl/hooks'
import { Box, Button, CircularProgress } from 'decentraland-ui2'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'
import { SummaryWrapper } from './WalletInteraction.styled'

export const WalletInteraction = ({
  requestId,
  isWeb2Wallet = false,
  explorerText = 'Explorer',
  isLoading = false,
  simulation,
  userAddress = '',
  profiles,
  verifiedContracts,
  chainId,
  onDeny,
  onApprove
}: WalletInteractionProps) => {
  const { t } = useTranslation()
  const hasSummary = simulation !== undefined && simulation.status !== 'idle'

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>
        {isWeb2Wallet ? t('request.wallet_interaction.title_web2') : t('request.wallet_interaction.title_web3', { explorerText })}
      </Box>
      {hasSummary ? (
        <SummaryWrapper>
          <SimulationSummary
            simulation={simulation}
            userAddress={userAddress}
            profiles={profiles}
            verifiedContracts={verifiedContracts}
            chainId={chainId}
          />
        </SummaryWrapper>
      ) : (
        <Box className={styles.description}>{t('request.wallet_interaction.description')}</Box>
      )}
      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="wallet-interaction-deny-button">
          {t('common.deny')}
        </Button>
        <Button variant="contained" disabled={isLoading} onClick={onApprove} data-testid="wallet-interaction-allow-button">
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
