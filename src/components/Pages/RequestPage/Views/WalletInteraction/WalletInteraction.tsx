import { useState } from 'react'
import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { getPreviewFingerprint, hasNoVisibleEffects } from '../../../../../shared/auth'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { KnownContractNotice } from '../KnownContractNotice'
import { RetryPreviewButton } from '../RetryPreviewButton'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'
import { PreviewUnavailableWarning, ReviewRestartedNotice, SummaryBody } from './WalletInteraction.styled'

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
  gasCovered = false,
  transactionCost = BigInt(0),
  balance = BigInt(0),
  isReverted = false,
  reviewRestarted = false,
  targetAddress,
  targetChainId,
  onRetryPreview,
  onDeny,
  onApprove
}: WalletInteractionProps) => {
  const { t } = useTranslation()
  // The preview could not be produced (simulation service down, or the call could not be simulated).
  // The effects can't be shown, so warn explicitly and word the acknowledgment for that case.
  const isPreviewUnavailable = simulation?.status === 'unavailable'
  const needsAcknowledgment = requiresAcknowledgment || isPreviewUnavailable
  // The preview resolved but shows nothing the user can check. The call may still change state the
  // summary cannot show, so the acknowledgment says that instead of talking about approvals.
  const isPreviewWithoutVisibleEffects = simulation?.status === 'ready' && hasNoVisibleEffects(simulation.result, userAddress)
  // The statement being acknowledged: this request and exactly this preview — outcome, movements
  // and approvals. Stored as a key and derived, never synced, so a tick cannot carry over to another
  // request, another outcome or a re-simulation that showed something else, and the button is right
  // in the same render the statement changes.
  const acknowledgmentStatement = [
    requestId,
    simulation?.status ?? 'idle',
    isReverted ? 'reverted' : '',
    isPreviewWithoutVisibleEffects ? 'no-visible-effects' : '',
    getPreviewFingerprint(simulation?.status === 'ready' ? simulation.result : undefined)
  ].join('|')
  const [acknowledgedStatement, setAcknowledgedStatement] = useState<string | null>(null)
  const acknowledged = acknowledgedStatement === acknowledgmentStatement
  const hasSummary = simulation !== undefined && simulation.status !== 'idle'
  // Block approval while the request is submitting, while the simulation is still resolving (so a
  // user can't approve before the summary and any high-risk warnings render), and until any
  // required acknowledgment is given.
  const approveBlocked = isLoading || simulation?.status === 'loading' || (needsAcknowledgment && !acknowledged)

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
          <KnownContractNotice address={targetAddress} chainId={targetChainId} />
          <SimulationSummary
            simulation={simulation}
            userAddress={userAddress}
            profiles={profiles}
            verifiedContracts={verifiedContracts}
            chainId={chainId}
            gas={{ covered: gasCovered, cost: formatEther(transactionCost), balance: formatEther(balance) }}
          />
        </SummaryBody>
        {reviewRestarted ? (
          <ReviewRestartedNotice severity="info" role="status" data-testid="review-restarted-notice">
            {t('request.wallet_interaction.review_restarted_notice')}
          </ReviewRestartedNotice>
        ) : null}
        {isPreviewUnavailable ? (
          <PreviewUnavailableWarning severity="warning" role="alert" data-testid="preview-unavailable-warning">
            {/* The retry is promised only where it is offered. */}
            {t(
              onRetryPreview
                ? 'request.wallet_interaction.preview_unavailable_warning_retry'
                : 'request.wallet_interaction.preview_unavailable_warning'
            )}
          </PreviewUnavailableWarning>
        ) : null}
        {needsAcknowledgment ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={event => setAcknowledgedStatement(event.target.checked ? acknowledgmentStatement : null)}
                data-testid="risk-acknowledgment"
              />
            }
            label={
              isPreviewUnavailable
                ? t('request.wallet_interaction.acknowledge_preview_unavailable')
                : isPreviewWithoutVisibleEffects
                  ? t('request.transaction_dialog.acknowledge_no_visible_effects')
                  : t('request.transaction_dialog.acknowledge_risk')
            }
          />
        ) : null}
        <ButtonsContainer>
          <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="transfer-cancel-button">
            {t('common.deny')}
          </Button>
          {isPreviewUnavailable && onRetryPreview ? (
            <RetryPreviewButton
              disabled={isLoading}
              onRetry={() => {
                setAcknowledgedStatement(null)
                onRetryPreview()
              }}
            />
          ) : null}
          <Button
            variant="contained"
            color={isReverted ? 'error' : 'primary'}
            disabled={approveBlocked}
            onClick={onApprove}
            data-testid="transfer-confirm-button"
          >
            {isLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              t(isPreviewUnavailable ? 'request.transaction_dialog.approve_without_preview' : 'common.allow')
            )}
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
      {/* No provenance notice on this screen: nothing else here describes the call, so a true "known
          contract" line would only prime a single-click Allow (an unlimited approve to MANA targets a
          known contract too). It is shown where a preview or an acknowledgment stands beside it. */}
      {reviewRestarted ? (
        <ReviewRestartedNotice severity="info" role="status" data-testid="review-restarted-notice">
          {t('request.wallet_interaction.review_restarted_notice')}
        </ReviewRestartedNotice>
      ) : null}
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
