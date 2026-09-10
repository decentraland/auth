import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { hasNoVisibleEffects } from '../../../../../shared/auth'
import { Container } from '../../Container'
import { ButtonsContainer, ReviewRestartedNotice } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'
import { CallLine, PreviewUnavailableWarning, SummaryBody } from './WalletInteraction.styled'

/**
 * The review of a transaction to a Decentraland contract: the decoded call, the simulated asset and
 * permission changes, and gas. Anything that is not a Decentraland contract call never reaches this
 * view (see UnverifiedRequestView).
 */
export const WalletInteraction = ({
  requestId,
  isLoading = false,
  functionName,
  contractName,
  simulation,
  userAddress = '',
  profiles,
  verifiedContracts,
  collectionContracts,
  chainId,
  requiresAcknowledgment = false,
  acknowledged = false,
  approveBlocked = true,
  gas,
  isReverted = false,
  reviewRestarted = false,
  onAcknowledgedChange,
  onDeny,
  onApprove
}: WalletInteractionProps) => {
  const { t } = useTranslation()
  // The preview could not be produced (simulation service down, or the call could not be simulated).
  // The effects can't be shown, so warn explicitly and word the acknowledgment for that case.
  const isPreviewUnavailable = simulation.status === 'unavailable'
  // The preview resolved but shows nothing the user can check. The call may still change state the
  // summary cannot show, so the acknowledgment says that instead of talking about approvals.
  const isPreviewWithoutVisibleEffects = simulation.status === 'ready' && hasNoVisibleEffects(simulation.result, userAddress)
  // Whether Allow may be pressed, and whether the tick counts, are the page's to decide: it holds every
  // gate in one place so the confirmation dialog and the approval handler cannot disagree with this button
  // (see isReviewActionable in RequestPage). This view still derives what it *says* — which acknowledgment
  // wording applies, whether to warn that the preview is missing — from the preview it renders.
  const summaryGas = gas.covered
    ? { covered: true, cost: '0', balance: '0' }
    : gas.status === 'ready'
      ? { covered: false, cost: formatEther(gas.cost), balance: gas.balance !== undefined ? formatEther(gas.balance) : undefined }
      : gas.status === 'unavailable'
        ? { covered: false, cost: '', balance: '', unavailable: true }
        : undefined

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>{t('request.wallet_interaction.review_title')}</Box>
      <CallLine data-testid="wallet-interaction-call">
        {t('request.wallet_interaction.calls_function', { functionName, contractName })}
      </CallLine>
      <SummaryBody>
        <SimulationSummary
          simulation={simulation}
          userAddress={userAddress}
          profiles={profiles}
          verifiedContracts={verifiedContracts}
          collectionContracts={collectionContracts}
          chainId={chainId}
          gas={summaryGas}
        />
      </SummaryBody>
      {reviewRestarted ? (
        <ReviewRestartedNotice severity="info" role="status" data-testid="review-restarted-notice">
          {t('request.wallet_interaction.review_restarted_notice')}
        </ReviewRestartedNotice>
      ) : null}
      {isPreviewUnavailable ? (
        <PreviewUnavailableWarning severity="warning" role="alert" data-testid="preview-unavailable-warning">
          {t('request.wallet_interaction.preview_unavailable_warning')}
        </PreviewUnavailableWarning>
      ) : null}
      {requiresAcknowledgment ? (
        <FormControlLabel
          control={
            <Checkbox
              checked={acknowledged}
              onChange={event => onAcknowledgedChange?.(event.target.checked)}
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
        <Button
          variant="contained"
          color={isReverted ? 'error' : 'primary'}
          disabled={approveBlocked}
          onClick={onApprove}
          data-testid="transfer-confirm-button"
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
