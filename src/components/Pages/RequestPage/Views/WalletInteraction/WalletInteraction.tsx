import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'
import { SummaryBody } from './WalletInteraction.styled'

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
  requiresAcknowledgment = false,
  onDeny,
  onApprove
}: WalletInteractionProps) => {
  const { t } = useTranslation()
  const [acknowledged, setAcknowledged] = useState(false)
  const hasSummary = simulation !== undefined && simulation.status !== 'idle'
  // Block approval while the simulation is still resolving so a user can't approve before the
  // summary (and any high-risk warnings) render, and until any required acknowledgment is given.
  const approveBlocked = simulation?.status === 'loading' || (requiresAcknowledgment && !acknowledged)

  // When a simulation is available, present the asset-change summary in the classic left-aligned
  // Container layout (matching the signature and generic interaction views, including the
  // change-profile footer), gating approval behind a high-risk acknowledgment when the transaction
  // grants broad permissions.
  if (hasSummary) {
    return (
      <Container canChangeAccount requestId={requestId}>
        <Box className={styles.logo}></Box>
        <Box className={styles.title}>{t('request.wallet_interaction.review_title')}</Box>
        <SummaryBody>
          <SimulationSummary
            simulation={simulation}
            userAddress={userAddress}
            profiles={profiles}
            verifiedContracts={verifiedContracts}
            chainId={chainId}
          />
        </SummaryBody>
        {requiresAcknowledgment ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={event => setAcknowledged(event.target.checked)}
                data-testid="risk-acknowledgment"
              />
            }
            label={t('request.transaction_dialog.acknowledge_risk')}
          />
        ) : null}
        <ButtonsContainer>
          <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="transfer-cancel-button">
            {t('common.deny')}
          </Button>
          <Button variant="contained" disabled={approveBlocked} onClick={onApprove} data-testid="transfer-confirm-button">
            {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
          </Button>
        </ButtonsContainer>
      </Container>
    )
  }

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>
        {isWeb2Wallet ? t('request.wallet_interaction.title_web2') : t('request.wallet_interaction.title_web3', { explorerText })}
      </Box>
      <Box className={styles.description}>{t('request.wallet_interaction.description')}</Box>
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
