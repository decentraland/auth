import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Alert, CircularProgress } from 'decentraland-ui2'
import { ApprovalChange, AssetChange, SimulationResponseBody } from '../../../../../shared/auth'
import { SimulationSummaryProps } from './SimulationSummary.types'
import {
  ApprovalLine,
  ApprovalsAlert,
  ChangeAmount,
  ChangeMeta,
  ChangeRow,
  ChangeText,
  DollarValue,
  EventList,
  EventRow,
  LoadingRow,
  NetLine,
  NetValue,
  Root,
  Section,
  SectionTitle,
  Toggle,
  TokenLogo,
  TokenLogoFallback,
  UnavailableNote
} from './SimulationSummary.styled'

type Translate = (key: string, opts?: Record<string, string | number>) => string

const shortenAddress = (address: string | null): string => {
  if (!address) return ''
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

/** Display name for a counterparty: resolved profile name if known, else a shortened address. */
const counterpartyLabel = (address: string | null, profiles: Record<string, string>): string => {
  if (!address) return ''
  return profiles[address.toLowerCase()] || shortenAddress(address)
}

/** Formats a USD string. `signed` keeps the +/- sign (for net changes); otherwise magnitude. */
const formatUsd = (dollarValue: string | null, signed = false): string | null => {
  if (dollarValue === null) return null
  const value = Number(dollarValue)
  if (!Number.isFinite(value)) return null
  const magnitude = `$${Math.abs(value).toFixed(2)}`
  if (!signed) return magnitude
  return `${value < 0 ? '-' : '+'}${magnitude}`
}

const assetTitle = (change: AssetChange, t: Translate): string => {
  if (change.standard === 'erc721' || change.standard === 'erc1155') {
    const name = change.name || change.symbol
    const tokenId = change.tokenId ? `#${change.tokenId}` : ''
    return (
      [name, tokenId].filter(Boolean).join(' ') ||
      tokenId ||
      t('request.transaction_dialog.unknown_token', { address: shortenAddress(change.contractAddress) })
    )
  }
  const symbol = change.symbol || (change.standard === 'native' ? 'ETH' : '')
  const amount = change.amount ?? change.rawAmount
  if (amount && symbol) return `${amount} ${symbol}`
  if (amount) return amount
  return symbol || t('request.transaction_dialog.unknown_token', { address: shortenAddress(change.contractAddress) })
}

const AssetRow = ({
  change,
  direction,
  profiles
}: {
  change: AssetChange
  direction: 'send' | 'receive'
  profiles: Record<string, string>
}) => {
  const { t } = useTranslation()
  const title = assetTitle(change, t)
  const dollar = formatUsd(change.dollarValue)
  const fallbackInitial = (change.symbol || change.name || '?').charAt(0)

  let meta: string
  if (change.type === 'mint') {
    meta = t('request.transaction_dialog.minted')
  } else if (change.type === 'burn') {
    meta = t('request.transaction_dialog.burned')
  } else if (direction === 'send') {
    meta = t('request.transaction_dialog.to_recipient', { recipient: counterpartyLabel(change.to, profiles) })
  } else {
    meta = t('request.transaction_dialog.from_sender', { sender: counterpartyLabel(change.from, profiles) })
  }

  return (
    <ChangeRow>
      {change.logoUrl ? <TokenLogo src={change.logoUrl} alt={title} /> : <TokenLogoFallback>{fallbackInitial}</TokenLogoFallback>}
      <ChangeText>
        <ChangeAmount>
          {title}
          {dollar ? <DollarValue>≈ {dollar}</DollarValue> : null}
        </ChangeAmount>
        <ChangeMeta>{meta}</ChangeMeta>
      </ChangeText>
    </ChangeRow>
  )
}

const ApprovalItem = ({ approval, profiles }: { approval: ApprovalChange; profiles: Record<string, string> }) => {
  const { t } = useTranslation()
  const token = approval.name || approval.symbol || shortenAddress(approval.contractAddress)
  const spender = counterpartyLabel(approval.spender, profiles)

  if (approval.kind === 'approvalForAll') {
    if (approval.approved === false) {
      return <ApprovalLine>{t('request.transaction_dialog.approval_for_all_revoked', { spender, name: token })}</ApprovalLine>
    }
    return <ApprovalLine emphasized>{t('request.transaction_dialog.approval_for_all', { spender, name: token })}</ApprovalLine>
  }

  if (approval.tokenId) {
    return <ApprovalLine>{t('request.transaction_dialog.approval_erc721', { spender, token, tokenId: approval.tokenId })}</ApprovalLine>
  }

  const symbol = approval.symbol || token
  const amount = approval.isUnlimited ? t('request.transaction_dialog.approval_unlimited') : (approval.amount ?? approval.rawAmount ?? '')
  return (
    <ApprovalLine emphasized={approval.isUnlimited}>
      {t('request.transaction_dialog.approval_description', { spender, amount, symbol })}
    </ApprovalLine>
  )
}

const NetChange = ({ result, userAddress, t }: { result: SimulationResponseBody; userAddress: string; t: Translate }) => {
  const net = (result.balanceChanges ?? []).find(change => change.address === userAddress && change.dollarValue !== null)
  const formatted = net ? formatUsd(net.dollarValue, true) : null
  if (!formatted) return null
  return (
    <NetLine>
      {t('request.transaction_dialog.net_change')}
      <NetValue negative={formatted.startsWith('-')}>{formatted}</NetValue>
    </NetLine>
  )
}

const TechnicalDetails = ({ events, t }: { events: SimulationResponseBody['events']; t: Translate }) => {
  const [open, setOpen] = useState(false)
  if (events.length === 0) return null
  return (
    <>
      <Toggle type="button" onClick={() => setOpen(show => !show)}>
        {open ? t('request.transaction_dialog.hide_technical_details') : t('request.transaction_dialog.technical_details')}
      </Toggle>
      {open ? (
        <EventList data-testid="simulation-events">
          {events.map((event, index) => (
            <EventRow key={`event-${index}`}>
              {(event.name || t('request.transaction_dialog.event_unknown')) + ` · ${shortenAddress(event.address)}`}
            </EventRow>
          ))}
        </EventList>
      ) : null}
    </>
  )
}

export const SimulationSummary = ({ simulation, userAddress, profiles = {} }: SimulationSummaryProps) => {
  const { t } = useTranslation()

  if (simulation.status === 'idle') return null

  if (simulation.status === 'loading') {
    return (
      <Root>
        <LoadingRow>
          <CircularProgress size={16} color="inherit" />
          {t('request.transaction_dialog.simulation_loading')}
        </LoadingRow>
      </Root>
    )
  }

  if (simulation.status === 'unavailable') {
    // Not an error state: a transaction can be unpreviewable for benign reasons (an
    // unverifiable contract, provider limits). Show a neutral note, never an error.
    return (
      <Root>
        <UnavailableNote>{t('request.transaction_dialog.details_unavailable')}</UnavailableNote>
      </Root>
    )
  }

  const { result } = simulation
  const user = userAddress.toLowerCase()
  // "Sends" are assets leaving the user's account (transfers out, and burns whose `from` is
  // the user). Everything else (assets received, mints to the user, and effects where the
  // user is neither party) is grouped under "receives".
  const sends = result.assetChanges.filter(change => change.from?.toLowerCase() === user)
  const receives = result.assetChanges.filter(change => change.from?.toLowerCase() !== user)
  const hasNoChanges = sends.length === 0 && receives.length === 0 && result.approvalChanges.length === 0

  return (
    <Root>
      {result.status === 'reverted' ? (
        <Alert severity="error">
          <strong>{t('request.transaction_dialog.revert_title')}</strong>
          <div>{t('request.transaction_dialog.revert_description', { reason: result.error ? `: ${result.error}` : '' })}</div>
        </Alert>
      ) : null}

      {sends.length > 0 ? (
        <Section>
          <SectionTitle>{t('request.transaction_dialog.you_send')}</SectionTitle>
          {sends.map((change, index) => (
            <AssetRow key={`send-${index}`} change={change} direction="send" profiles={profiles} />
          ))}
        </Section>
      ) : null}

      {receives.length > 0 ? (
        <Section>
          <SectionTitle>{t('request.transaction_dialog.you_receive')}</SectionTitle>
          {receives.map((change, index) => (
            <AssetRow key={`receive-${index}`} change={change} direction="receive" profiles={profiles} />
          ))}
        </Section>
      ) : null}

      <NetChange result={result} userAddress={user} t={t} />

      {result.approvalChanges.length > 0 ? (
        <ApprovalsAlert severity="warning">
          <SectionTitle>{t('request.transaction_dialog.approvals_title')}</SectionTitle>
          {result.approvalChanges.map((approval, index) => (
            <ApprovalItem key={`approval-${index}`} approval={approval} profiles={profiles} />
          ))}
        </ApprovalsAlert>
      ) : null}

      {hasNoChanges && result.status !== 'reverted' ? (
        <UnavailableNote>{t('request.transaction_dialog.no_changes')}</UnavailableNote>
      ) : null}

      <TechnicalDetails events={result.events ?? []} t={t} />
    </Root>
  )
}
