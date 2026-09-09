import { useMemo, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { getPreviewFingerprint, hasNoVisibleEffects } from '../../../../../shared/auth'
import { getExplorerAddressUrl, getExplorerName } from '../../../../../shared/explorer'
import { shortenAddress } from '../../../../../shared/text'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import { formatTypedDataForDisplay } from '../typedDataDisplay'
import { useAcknowledgment } from '../useAcknowledgment'
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
  chainId,
  requiresAcknowledgment = false,
  previewCaveat = null,
  isLoading = false,
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

  // The exact statement the user is asked to acknowledge: the request it belongs to, the label, and
  // every notice shown alongside it (see useAcknowledgment).
  const acknowledgmentStatement = [
    requestId,
    isUnverifiable ? 'unverified' : 'risk',
    isReverted ? 'reverted' : '',
    simulation.status === 'unavailable' ? 'unavailable' : '',
    isPreviewWithoutVisibleEffects ? 'no-visible-effects' : '',
    previewCaveat ?? '',
    // Exactly this preview: a re-simulation that showed something else is another statement.
    getPreviewFingerprint(simulation.status === 'ready' ? simulation.result : undefined)
  ].join('|')
  const { acknowledged, setAcknowledged } = useAcknowledgment(acknowledgmentStatement)

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
          chainId={chainId}
        />
        <Notice data-testid="signature-meta-tx-notice">{t('request.signature.meta_tx_notice')}</Notice>
        {isReverted ? <Notice data-testid="signature-meta-tx-reverted">{t('request.signature.meta_tx_reverted')}</Notice> : null}
        {previewCaveat === 'recipient_contract' ? (
          <Notice data-testid="preview-caveat-warning">{t('request.wallet_interaction.recipient_contract_warning')}</Notice>
        ) : null}
        <RawToggle type="button" aria-expanded={showRaw} onClick={() => setShowRaw(show => !show)}>
          {showRaw ? t('request.signature.hide_raw') : t('request.signature.view_raw')}
        </RawToggle>
        {showRaw ? <MessageBlock data-testid="signature-raw">{rawForDisplay}</MessageBlock> : null}

        {requiresAcknowledgment ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={event => setAcknowledged(event.target.checked)}
                data-testid="risk-acknowledgment"
              />
            }
            label={
              isUnverifiable
                ? t('request.signature.acknowledge_unverified')
                : previewCaveat === 'recipient_contract'
                  ? t('request.wallet_interaction.acknowledge_recipient_contract')
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
          disabled={
            isLoading || simulation.status === 'idle' || simulation.status === 'loading' || (requiresAcknowledgment && !acknowledged)
          }
          onClick={onApprove}
          data-testid="signature-approve-button"
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
