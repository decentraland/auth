import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, CircularProgress } from 'decentraland-ui2'
import { Container } from '../../Container'
import { ButtonsContainer } from '../../RequestPage.styled'
import { SimulationSummary } from '../SimulationSummary'
import styles from '../Views.module.css'
import { TypedDataTree } from './TypedDataTree'
import { SignatureRequestViewProps } from './SignatureRequest.types'
import {
  Content,
  DomainKey,
  DomainRow,
  DomainValue,
  FieldLabel,
  MessageBlock,
  MethodChip,
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
  isMetaTransaction,
  isLoading = false,
  onDeny,
  onApprove
}: SignatureRequestViewProps) => {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  const domain = payload?.kind === 'typedData' ? payload.typedData.domain : undefined

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
            <SimulationSummary simulation={simulation} userAddress={userAddress} />
            <RawToggle type="button" onClick={() => setShowRaw(show => !show)}>
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
                    <DomainValue>{String(domain.chainId)}</DomainValue>
                  </DomainRow>
                ) : null}
                {typeof domain.verifyingContract === 'string' ? (
                  <DomainRow>
                    <DomainKey>{t('request.signature.contract')}</DomainKey>
                    <DomainValue>{shortenAddress(domain.verifyingContract)}</DomainValue>
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
      </Content>

      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="signature-deny-button">
          {t('common.deny')}
        </Button>
        <Button variant="contained" disabled={isLoading} onClick={onApprove} data-testid="signature-approve-button">
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
