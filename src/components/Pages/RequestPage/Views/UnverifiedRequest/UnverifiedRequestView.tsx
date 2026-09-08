import { useState } from 'react'
import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { Box, Button, Checkbox, CircularProgress, FormControlLabel, Tab } from 'decentraland-ui2'
import { getExplorerAddressUrl, getExplorerName, getNativeSymbol, getNetworkName } from '../../../../../shared/explorer'
import { shortenAddress } from '../../../../../shared/text'
import { isTransactionKind } from '../../classifyRequest'
import { Container } from '../../Container'
import { ButtonsContainer, ReviewRestartedNotice } from '../../RequestPage.styled'
import { useAcknowledgment } from '../useAcknowledgment'
import styles from '../Views.module.css'
import { UnverifiedRequestKind, UnverifiedRequestViewProps } from './UnverifiedRequest.types'
import {
  Content,
  ExplorerLink,
  FactKey,
  FactValue,
  Facts,
  Hint,
  Intro,
  Panel,
  RawBlock,
  RawLabel,
  SelfNote,
  TabBar,
  WarningsAlert,
  WarningsTitle
} from './UnverifiedRequest.styled'

type TabId = 'summary' | 'advanced'

const SIGNATURE_WARNINGS = [
  'request.unverified.warning_signature_login',
  'request.unverified.warning_signature_orders',
  'request.unverified.warning_signature_unverifiable',
  'request.unverified.trust_scene'
]

/** The warning list for a kind: its title key and its item keys. */
function getWarnings(kind: UnverifiedRequestKind): { title: string; items: string[] } {
  switch (kind) {
    case 'unknown_transaction':
      return {
        title: 'request.unverified.warnings_title_transaction',
        items: [
          'request.unverified.warning_transaction_assets',
          'request.unverified.warning_transaction_final',
          'request.unverified.trust_scene'
        ]
      }
    case 'native_transfer':
      return {
        title: 'request.unverified.warnings_title_transaction',
        items: ['request.unverified.warning_transaction_final', 'request.unverified.trust_scene']
      }
    case 'unknown_meta_transaction':
      return {
        title: 'request.unverified.warnings_title_meta_transaction',
        items: [
          'request.unverified.warning_meta_tx_no_expiry',
          'request.unverified.warning_meta_tx_bearer',
          'request.unverified.warning_meta_tx_unknown_call',
          'request.unverified.warning_meta_tx_no_preview',
          'request.unverified.trust_scene'
        ]
      }
    case 'unknown_typed_data':
    case 'personal_sign':
      return { title: 'request.unverified.warnings_title_signature', items: SIGNATURE_WARNINGS }
  }
}

function getIntroKey(kind: UnverifiedRequestKind): string {
  switch (kind) {
    case 'unknown_transaction':
      return 'request.unverified.intro_transaction'
    case 'native_transfer':
      return 'request.unverified.intro_native_transfer'
    case 'unknown_meta_transaction':
      return 'request.unverified.intro_meta_transaction'
    case 'unknown_typed_data':
    case 'personal_sign':
      return 'request.unverified.intro_signature'
  }
}

function getAcknowledgmentKey(kind: UnverifiedRequestKind): string {
  switch (kind) {
    case 'unknown_transaction':
      return 'request.unverified.acknowledge_transaction'
    case 'native_transfer':
      return 'request.unverified.acknowledge_native_transfer'
    case 'unknown_meta_transaction':
      return 'request.unverified.acknowledge_meta_transaction'
    case 'unknown_typed_data':
    case 'personal_sign':
      return 'request.unverified.acknowledge_signature'
  }
}

/**
 * The review of anything that is not a call to a Decentraland contract: a transaction to any other
 * contract, a plain value transfer, a MetaTransaction Auth cannot vouch for, any other typed data, or
 * a personal_sign message. Nothing is simulated or interpreted. The user is told what such a request
 * can do, sees the facts Auth can state (target, network, amount, fee) and, under Advanced, exactly
 * what the wallet will sign or send, and must acknowledge the risk before Allow enables.
 */
export const UnverifiedRequestView = ({
  requestId,
  kind,
  method,
  targetAddress = null,
  targetIsSelf = false,
  chainId = null,
  nativeValue,
  gas,
  balance,
  payload,
  payloadFingerprint,
  isLoading = false,
  reviewRestarted = false,
  onDeny,
  onApprove
}: UnverifiedRequestViewProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabId>('summary')
  // The statement the user ticked: this request, this kind, this chain and exactly this payload. A
  // tick given to one payload never carries over to another (see useAcknowledgment).
  const acknowledgmentStatement = [requestId, kind, chainId ?? '', payloadFingerprint].join('|')
  const { acknowledged, setAcknowledged } = useAcknowledgment(acknowledgmentStatement)

  const isTransaction = isTransactionKind(kind)
  // A wallet can be on a chain this page does not know. That is exactly a case this view exists for,
  // so the chain is still named (by its id) and amounts still say what they are in.
  const nativeSymbol = getNativeSymbol(chainId ?? undefined) || t('request.unverified.native_currency')
  const native = nativeValue !== undefined ? { amount: formatEther(BigInt(nativeValue)), symbol: nativeSymbol } : null
  const showsAmount = native !== null && (kind === 'native_transfer' || BigInt(nativeValue ?? '0x0') !== 0n)
  const networkName = getNetworkName(chainId ?? undefined) || (chainId !== null ? t('request.unverified.unknown_network', { chainId }) : '')
  const explorerUrl = getExplorerAddressUrl(chainId ?? undefined, targetAddress)
  const explorerName = getExplorerName(chainId ?? undefined)
  // The user always sees the cost before sending: on a transaction, Allow waits for the estimate.
  const isFeePending = isTransaction && (!gas || gas.status === 'loading')
  const approveBlocked = isLoading || isFeePending || !acknowledged
  const acknowledgmentLabel =
    kind === 'native_transfer' && native
      ? t(getAcknowledgmentKey(kind), { amount: native.amount, symbol: native.symbol })
      : t(getAcknowledgmentKey(kind))
  const warnings = getWarnings(kind)

  const target = targetAddress ? (
    <FactValue>
      {explorerUrl ? (
        <ExplorerLink
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t('request.transaction_dialog.view_on_explorer', { explorer: explorerName })}
        >
          {shortenAddress(targetAddress)}
        </ExplorerLink>
      ) : (
        shortenAddress(targetAddress)
      )}
      {targetIsSelf ? <SelfNote>({t('request.unverified.your_own_address')})</SelfNote> : null}
    </FactValue>
  ) : null

  return (
    <Container canChangeAccount requestId={requestId}>
      <Box className={styles.logo}></Box>
      <Box className={styles.title}>{t(isTransaction ? 'request.unverified.title_transaction' : 'request.unverified.title_signature')}</Box>
      <Content data-testid="unverified-request" data-kind={kind}>
        <Intro data-testid="unverified-intro">
          {kind === 'native_transfer' && native
            ? t(getIntroKey(kind), { amount: native.amount, symbol: native.symbol })
            : t(getIntroKey(kind))}
        </Intro>

        <TabBar value={tab} onChange={(_event, value: TabId) => setTab(value)} aria-label={t('request.unverified.tabs_label')}>
          <Tab
            value="summary"
            id="unverified-tab-summary"
            aria-controls="unverified-panel-summary"
            label={t('request.unverified.tab_summary')}
            data-testid="unverified-tab-summary"
          />
          <Tab
            value="advanced"
            id="unverified-tab-advanced"
            aria-controls="unverified-panel-advanced"
            label={t('request.unverified.tab_advanced')}
            data-testid="unverified-tab-advanced"
          />
        </TabBar>

        {tab === 'summary' ? (
          <Panel role="tabpanel" id="unverified-panel-summary" aria-labelledby="unverified-tab-summary" data-testid="unverified-summary">
            <Facts>
              {target ? (
                <>
                  <FactKey>
                    {t(kind === 'native_transfer' ? 'request.unverified.fact_recipient' : 'request.unverified.fact_contract')}
                  </FactKey>
                  {target}
                </>
              ) : null}
              {networkName ? (
                <>
                  <FactKey>{t('request.unverified.fact_network')}</FactKey>
                  <FactValue>{networkName}</FactValue>
                </>
              ) : null}
              {showsAmount && native ? (
                <>
                  <FactKey>{t('request.unverified.fact_amount')}</FactKey>
                  <FactValue data-testid="unverified-amount">
                    {native.amount} {native.symbol}
                  </FactValue>
                </>
              ) : null}
              {isTransaction ? (
                <>
                  <FactKey>{t('request.unverified.fact_fee')}</FactKey>
                  <FactValue data-testid="unverified-fee">
                    {!gas || gas.status === 'loading'
                      ? t('request.unverified.fact_fee_loading')
                      : gas.status === 'unavailable'
                        ? t('request.unverified.fact_fee_unavailable')
                        : `${formatEther(gas.cost)} ${nativeSymbol}`}
                  </FactValue>
                </>
              ) : null}
              {isTransaction && balance !== undefined ? (
                <>
                  <FactKey>{t('request.unverified.fact_balance')}</FactKey>
                  <FactValue>
                    {formatEther(balance)} {nativeSymbol}
                  </FactValue>
                </>
              ) : null}
              {!isTransaction ? (
                <>
                  <FactKey>{t('request.unverified.fact_method')}</FactKey>
                  <FactValue>{method}</FactValue>
                </>
              ) : null}
            </Facts>

            {payload.kind === 'message' ? (
              payload.text !== null ? (
                <RawBlock data-testid="unverified-message">{payload.text}</RawBlock>
              ) : (
                <Hint data-testid="unverified-message-unreadable">{t('request.unverified.message_unreadable')}</Hint>
              )
            ) : null}

            <WarningsAlert severity="warning" role="alert" data-testid="unverified-warnings">
              <WarningsTitle>{t(warnings.title)}</WarningsTitle>
              <ul>
                {warnings.items.map(item => (
                  <li key={item}>{t(item)}</li>
                ))}
              </ul>
            </WarningsAlert>
          </Panel>
        ) : (
          <Panel role="tabpanel" id="unverified-panel-advanced" aria-labelledby="unverified-tab-advanced" data-testid="unverified-advanced">
            <Hint>{t(isTransaction ? 'request.unverified.advanced_hint_transaction' : 'request.unverified.advanced_hint_signature')}</Hint>
            {payload.kind === 'transaction' ? (
              <>
                <RawLabel>{t('request.unverified.raw_to')}</RawLabel>
                <RawBlock data-testid="unverified-raw-to">{payload.to}</RawBlock>
                <RawLabel>{t('request.unverified.raw_value')}</RawLabel>
                <RawBlock data-testid="unverified-raw-value">
                  {payload.value}
                  {native ? ` (${native.amount} ${native.symbol})` : ''}
                </RawBlock>
                <RawLabel>{t('request.unverified.raw_data')}</RawLabel>
                <RawBlock data-testid="unverified-raw-data">{payload.data}</RawBlock>
                {chainId !== null ? (
                  <>
                    <RawLabel>{t('request.unverified.raw_chain')}</RawLabel>
                    <RawBlock>{chainId}</RawBlock>
                  </>
                ) : null}
              </>
            ) : null}
            {payload.kind === 'typed_data' ? (
              <>
                <RawLabel>{t('request.unverified.raw_typed_data')}</RawLabel>
                <RawBlock data-testid="unverified-raw-typed-data">{payload.raw}</RawBlock>
              </>
            ) : null}
            {payload.kind === 'message' ? (
              <>
                {payload.text !== null ? (
                  <>
                    <RawLabel>{t('request.unverified.raw_message_text')}</RawLabel>
                    <RawBlock>{payload.text}</RawBlock>
                  </>
                ) : null}
                <RawLabel>{t('request.unverified.raw_message_hex')}</RawLabel>
                <RawBlock data-testid="unverified-raw-hex">{payload.hex}</RawBlock>
              </>
            ) : null}
          </Panel>
        )}

        {reviewRestarted ? (
          <ReviewRestartedNotice severity="info" role="status" data-testid="review-restarted-notice">
            {t('request.wallet_interaction.review_restarted_notice')}
          </ReviewRestartedNotice>
        ) : null}

        <FormControlLabel
          control={
            <Checkbox checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} data-testid="risk-acknowledgment" />
          }
          label={acknowledgmentLabel}
        />
      </Content>

      <ButtonsContainer>
        <Button variant="outlined" disabled={isLoading} onClick={onDeny} data-testid="unverified-deny-button">
          {t('common.deny')}
        </Button>
        <Button variant="contained" disabled={approveBlocked} onClick={onApprove} data-testid="unverified-approve-button">
          {isLoading ? <CircularProgress size={20} color="inherit" /> : t('common.allow')}
        </Button>
      </ButtonsContainer>
    </Container>
  )
}
