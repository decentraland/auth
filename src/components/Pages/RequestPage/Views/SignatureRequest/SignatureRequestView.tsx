import { useEffect, useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel } from 'decentraland-ui2'
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
  isLoading = false,
  onDeny,
  onApprove
}: SignatureRequestViewProps) => {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

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

  // A tick given to one statement must not carry over to another: when the wording changes (for
  // instance the contract lookup resolves to unrecognized after the user acknowledged an approval),
  // ask again.
  useEffect(() => {
    setAcknowledged(false)
  }, [hasUnverifiedEffects])

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

        {requiresAcknowledgment ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={event => setAcknowledged(event.target.checked)}
                data-testid="risk-acknowledgment"
              />
            }
            label={hasUnverifiedEffects ? t('request.signature.acknowledge_unverified') : t('request.transaction_dialog.acknowledge_risk')}
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
