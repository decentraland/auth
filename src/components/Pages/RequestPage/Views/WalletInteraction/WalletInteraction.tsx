import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { Title, TransferActionButtons, TransferLayout } from '../../../../Transfer'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'
import { AckRow, SummaryBody, SummaryCard } from './WalletInteraction.styled'

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

  // When a simulation is available, present the branded, full-page review layout with the
  // asset-change summary front and centre (matching the tip/gift flows), gating approval behind
  // a high-risk acknowledgment when the transaction grants broad permissions.
  if (hasSummary) {
    return (
      <TransferLayout>
        <SummaryCard>
          <Title>{t('request.wallet_interaction.review_title')}</Title>
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
            <AckRow>
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
            </AckRow>
          ) : null}
          <TransferActionButtons
            cancelText={t('common.deny')}
            confirmText={t('common.allow')}
            isLoading={isLoading}
            confirmDisabled={requiresAcknowledgment && !acknowledged}
            onCancel={onDeny}
            onConfirm={onApprove}
          />
        </SummaryCard>
      </TransferLayout>
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
