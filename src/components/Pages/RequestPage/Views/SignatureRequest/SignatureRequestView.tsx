import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
import { getPreviewFingerprint, hasNoVisibleEffects } from '../../../../../shared/auth'
import { getExplorerAddressUrl, getExplorerName, getNetworkName } from '../../../../../shared/explorer'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { TypedDataTree } from './TypedDataTree'
import { SignatureRequestViewProps } from './SignatureRequest.types'
import {
  Content,
  ContractLink,
  DomainKey,
  DomainRow,
  DomainValue,
  FieldLabel,
  MessageBlock,
  MethodChip,
  Notice,
  RawToggle,
  Section
} from './SignatureRequest.styled'

const shortenAddress = (address: string): string => (address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address)

export const SignatureRequestView = ({
  requestId,
  method,
  payload,
  simulation,
  userAddress,
  profiles,
  verifiedContracts,
  chainId,
  requiresAcknowledgment = false,
  isMetaTransaction,
  contractTrust,
  unverifiableReason = null,
  isLoading = false,
  onDeny,
  onApprove
}: SignatureRequestViewProps) => {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)
  // The statement the user ticked, if any (see acknowledgmentStatement below).
  const [acknowledgedStatement, setAcknowledgedStatement] = useState<string | null>(null)

  const domain = payload?.kind === 'typedData' ? payload.typedData.domain : undefined
  const domainChainId = chainId ?? (domain?.chainId !== undefined ? Number(domain.chainId) : undefined)
  const contractUrl = typeof domain?.verifyingContract === 'string' ? getExplorerAddressUrl(domainChainId, domain.verifyingContract) : null
  const isReverted = simulation.status === 'ready' && simulation.result.status === 'reverted'
  // Approval waits for the contract lookup the same way it waits for the simulation, so the
  // unrecognized-contract acknowledgment cannot be skipped by clicking before it resolves.
  const isContractTrustPending = isMetaTransaction && contractTrust === 'pending'
  const isContractUnrecognized = isMetaTransaction && contractTrust === 'unconfirmed'
  // A signed meta-transaction is a bearer authorization the requester can submit later, so when
  // its effects could not be previewed — or the contract that will execute it is not one Auth can
  // vouch for — the acknowledgment must say that, not talk about approvals.
  const hasUnverifiedEffects = isMetaTransaction && (simulation.status === 'unavailable' || isReverted || isContractUnrecognized)
  // Likewise when Auth cannot tell what the signature authorizes in the first place.
  const isUnverifiable = hasUnverifiedEffects || unverifiableReason !== null
  // The inner call previewed cleanly but moves nothing the user can check. It may still change state
  // the summary cannot show, so the acknowledgment says that instead of talking about approvals.
  const isPreviewWithoutVisibleEffects =
    isMetaTransaction && simulation.status === 'ready' && hasNoVisibleEffects(simulation.result, userAddress)

  // The exact statement the user is asked to acknowledge: the request it belongs to, the label, and
  // every notice shown alongside it. A tick is given to that statement only — when any part of it
  // changes (another request, the lookup resolving to unrecognized, a different reason), ask again.
  const acknowledgmentStatement = [
    requestId,
    isUnverifiable ? 'unverified' : 'risk',
    unverifiableReason ?? '',
    isReverted ? 'reverted' : '',
    isContractUnrecognized ? 'unrecognized-contract' : '',
    simulation.status === 'unavailable' ? 'unavailable' : '',
    isPreviewWithoutVisibleEffects ? 'no-visible-effects' : '',
    // Exactly this preview: a re-simulation that showed something else is another statement.
    getPreviewFingerprint(simulation.status === 'ready' ? simulation.result : undefined)
  ].join('|')
  // Derived, not synced: an effect would clear a stale tick one render late, and for that one commit
  // the Allow button would be enabled against a statement the user never acknowledged.
  const acknowledged = acknowledgedStatement === acknowledgmentStatement

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>{t('request.signature.title')}</Box>
      <Box className={styles.description}>{t('request.signature.description')}</Box>
      <Content>
        <MethodChip>{method}</MethodChip>

        {payload?.kind === 'message' ? (
          <Section>
            <FieldLabel>{t('request.signature.message_label')}</FieldLabel>
            <MessageBlock data-testid="signature-message">{payload.message}</MessageBlock>
          </Section>
        ) : null}

        {payload?.kind === 'typedData' && isMetaTransaction ? (
          <>
            <SimulationSummary
              simulation={simulation}
              userAddress={userAddress}
              profiles={profiles}
              verifiedContracts={verifiedContracts}
              chainId={chainId}
            />
            <Notice data-testid="signature-meta-tx-notice">{t('request.signature.meta_tx_notice')}</Notice>
            {isReverted ? <Notice data-testid="signature-meta-tx-reverted">{t('request.signature.meta_tx_reverted')}</Notice> : null}
            {isContractUnrecognized ? (
              <Notice data-testid="signature-meta-tx-unrecognized-contract">{t('request.signature.meta_tx_unrecognized_contract')}</Notice>
            ) : null}
            <RawToggle type="button" aria-expanded={showRaw} onClick={() => setShowRaw(show => !show)}>
              {showRaw ? t('request.signature.hide_raw') : t('request.signature.view_raw')}
            </RawToggle>
            {showRaw ? <MessageBlock data-testid="signature-raw">{payload.raw}</MessageBlock> : null}
          </>
        ) : null}

        {payload?.kind === 'typedData' && !isMetaTransaction ? (
          <>
            {domain ? (
              <Section>
                {typeof domain.name === 'string' ? (
                  <DomainRow>
                    <DomainKey>{domain.name}</DomainKey>
                  </DomainRow>
                ) : null}
                {domain.chainId !== undefined ? (
                  <DomainRow>
                    <DomainKey>{t('request.signature.network')}</DomainKey>
                    <DomainValue>{getNetworkName(Number(domain.chainId)) || String(domain.chainId)}</DomainValue>
                  </DomainRow>
                ) : null}
                {typeof domain.verifyingContract === 'string' ? (
                  <DomainRow>
                    <DomainKey>{t('request.signature.contract')}</DomainKey>
                    {contractUrl ? (
                      <ContractLink
                        href={contractUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('request.transaction_dialog.view_on_explorer', { explorer: getExplorerName(domainChainId) })}
                      >
                        {shortenAddress(domain.verifyingContract)}
                      </ContractLink>
                    ) : (
                      <DomainValue>{shortenAddress(domain.verifyingContract)}</DomainValue>
                    )}
                  </DomainRow>
                ) : null}
              </Section>
            ) : null}
            <Section>
              <FieldLabel>{t('request.signature.typed_data_label')}</FieldLabel>
              {payload.typedData.message ? <TypedDataTree data={payload.typedData.message} /> : <MessageBlock>{payload.raw}</MessageBlock>}
            </Section>
          </>
        ) : null}

        {!payload ? <MessageBlock>{t('request.signature.description')}</MessageBlock> : null}

        {unverifiableReason !== null ? (
          <Notice data-testid="signature-unverifiable-notice">
            {unverifiableReason === 'opaque_message'
              ? t('request.signature.opaque_message')
              : t('request.signature.unrecognized_typed_data')}
          </Notice>
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
          disabled={isLoading || simulation.status === 'loading' || isContractTrustPending || (requiresAcknowledgment && !acknowledged)}
          onClick={onApprove}
          data-testid="signature-approve-button"
        >
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
