import { useMemo, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { hasNoVisibleEffects } from '../../../../../shared/auth'
import { getExplorerAddressUrl, getExplorerName } from '../../../../../shared/explorer'
import { shortenAddress } from '../../../../../shared/text'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import { formatTypedDataForDisplay } from '../typedDataDisplay'
import styles from '../Views.module.css'
import { SignatureRequestViewProps } from './SignatureRequest.types'
import {
  CallLine,
  Content,
  ContractLink,
  DomainKey,
  DomainRow,
  DomainValue,
  MessageBlock,
  MethodChip,
  Notice,
  RawToggle
} from './SignatureRequest.styled'

/**
 * The review of a MetaTransaction signature for a Decentraland contract. Only a signature the
 * classifier proved to be one — known contract, exact struct and domain, decodable call — reaches
 * this view; any other typed data is shown by UnverifiedRequestView.
 */
export const SignatureRequestView = ({
  requestId,
  method,
  raw,
  verifyingContract,
  functionName,
  contractName,
  simulation,
  userAddress,
  profiles,
  verifiedContracts,
  collectionContracts,
  chainId,
  requiresAcknowledgment = false,
  deferredCallbackAddresses = [],
  deferredCallbackAcknowledged = false,
  onDeferredCallbackAcknowledgedChange,
  acknowledged = false,
  approveBlocked = true,
  isLoading = false,
  onAcknowledgedChange,
  onDeny,
  onApprove
}: SignatureRequestViewProps) => {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)
  // Parsing, pretty-printing and scanning the typed data is linear in its size; done once per payload, not per render.
  const rawForDisplay = useMemo(() => formatTypedDataForDisplay(raw), [raw])

  const contractUrl = getExplorerAddressUrl(chainId, verifyingContract)
  const isReverted = simulation.status === 'ready' && simulation.result.status === 'reverted'
  // A signed meta-transaction is a bearer authorization the requester can submit later, so when its
  // effects could not be previewed the acknowledgment must say that, not talk about approvals.
  const isUnverifiable = simulation.status === 'unavailable' || isReverted
  // The inner call previewed cleanly but moves nothing the user can check. It may still change state
  // the summary cannot show, so the acknowledgment says that instead of talking about approvals.
  const isPreviewWithoutVisibleEffects = simulation.status === 'ready' && hasNoVisibleEffects(simulation.result, userAddress)
  // Whether Allow may be pressed, and whether the tick counts, are the page's to decide: it holds every
  // gate in one place so the confirmation dialog and the approval handler cannot disagree with this button
  // (see isReviewActionable in RequestPage). This view still derives the wording it shows from the preview.

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>{t('request.signature.title')}</Box>
      <Box className={styles.description}>{t('request.signature.description')}</Box>
      <Content>
        <MethodChip>{method}</MethodChip>
        <CallLine data-testid="signature-call">{t('request.wallet_interaction.calls_function', { functionName, contractName })}</CallLine>
        <DomainRow>
          <DomainKey>{t('request.unverified.fact_contract')}</DomainKey>
          {contractUrl ? (
            <ContractLink
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t('request.transaction_dialog.view_on_explorer', { explorer: getExplorerName(chainId) })}
            >
              {shortenAddress(verifyingContract)}
            </ContractLink>
          ) : (
            <DomainValue>{shortenAddress(verifyingContract)}</DomainValue>
          )}
        </DomainRow>

        <SimulationSummary
          simulation={simulation}
          userAddress={userAddress}
          profiles={profiles}
          verifiedContracts={verifiedContracts}
          collectionContracts={collectionContracts}
          chainId={chainId}
        />
        <Notice data-testid="signature-meta-tx-notice">{t('request.signature.meta_tx_notice')}</Notice>
        {deferredCallbackAddresses.length > 0 ? (
          <>
            <Notice data-testid="signature-deferred-callback-notice">{t('request.transaction_dialog.callback_code_notice')}</Notice>
            <FormControlLabel
              control={
                <Checkbox
                  checked={deferredCallbackAcknowledged}
                  onChange={event => onDeferredCallbackAcknowledgedChange?.(event.target.checked)}
                />
              }
              label={t('request.transaction_dialog.acknowledge_callback_code')}
            />
          </>
        ) : null}
        {isReverted ? <Notice data-testid="signature-meta-tx-reverted">{t('request.signature.meta_tx_reverted')}</Notice> : null}
        <RawToggle type="button" aria-expanded={showRaw} onClick={() => setShowRaw(show => !show)}>
          {showRaw ? t('request.signature.hide_raw') : t('request.signature.view_raw')}
        </RawToggle>
        {showRaw ? <MessageBlock data-testid="signature-raw">{rawForDisplay}</MessageBlock> : null}

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
              isUnverifiable
                ? t('request.signature.acknowledge_unverified')
                : isPreviewWithoutVisibleEffects
                  ? t('request.transaction_dialog.acknowledge_no_visible_effects')
                  : t('request.transaction_dialog.acknowledge_risk')
            }
          />
        ) : null}
      </Content>

      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="signature-deny-button">
          {t('common.deny')}
        </Button>
        <Button
          variant="contained"
          color={isReverted ? 'error' : 'primary'}
          disabled={approveBlocked}
          onClick={onApprove}
          data-testid="signature-approve-button"
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
