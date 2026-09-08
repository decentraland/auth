import { useState } from 'react'
import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { getPreviewFingerprint, hasNoVisibleEffects } from '../../../../../shared/auth'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { WalletInteractionProps } from './WalletInteraction.types'
import { CallLine, PreviewUnavailableWarning, ReviewRestartedNotice, SummaryBody } from './WalletInteraction.styled'

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
  chainId,
  requiresAcknowledgment = false,
  gas,
  isReverted = false,
  reviewRestarted = false,
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
  // The statement being acknowledged: this request and exactly this preview — outcome, movements
  // and approvals. Stored as a key and derived, never synced, so a tick cannot carry over to another
  // request, another outcome or a re-simulation that showed something else, and the button is right
  // in the same render the statement changes.
  const acknowledgmentStatement = [
    requestId,
    simulation.status,
    isReverted ? 'reverted' : '',
    isPreviewWithoutVisibleEffects ? 'no-visible-effects' : '',
    getPreviewFingerprint(simulation.status === 'ready' ? simulation.result : undefined)
  ].join('|')
  const [acknowledgedStatement, setAcknowledgedStatement] = useState<string | null>(null)
  const acknowledged = acknowledgedStatement === acknowledgmentStatement
  // The user pays gas and the estimate has not resolved: the cost must be seen before approving.
  const isGasPending = !gas.covered && gas.status === 'loading'
  // Block approval while the request is submitting, while the simulation or the fee estimate is
  // still resolving (so a user can't approve before the summary, the cost and any high-risk warnings
  // render), and until any required acknowledgment is given.
  const approveBlocked = isLoading || simulation.status === 'loading' || isGasPending || (requiresAcknowledgment && !acknowledged)

  const summaryGas = gas.covered
    ? { covered: true, cost: '0', balance: '0' }
    : gas.status === 'ready'
      ? { covered: false, cost: formatEther(gas.cost), balance: formatEther(gas.balance) }
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
