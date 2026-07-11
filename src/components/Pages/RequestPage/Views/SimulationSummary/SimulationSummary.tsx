import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Alert, Skeleton } from 'decentraland-ui2'
import { ApprovalChange, AssetChange, SimulationResponseBody } from '../../../../../shared/auth'
import { getExplorerAddressUrl, getExplorerName, getNetworkName } from '../../../../../shared/explorer'
import { SimulationSummaryProps } from './SimulationSummary.types'
import {
  AmountUsd,
  ApprovalLine,
  ApprovalsAlert,
  ChangeAmount,
  ChangeMeta,
  ChangeRow,
  ChangeText,
  DirectionIndicator,
  EventList,
  EventRow,
  ExplorerLink,
  NetLine,
  NetValue,
  NetworkChip,
  RiskIcon,
  Root,
  Section,
  SectionTitle,
  SkeletonRow,
  Toggle,
  TokenLogo,
  TokenLogoFallback,
  UnavailableNote,
  VerifiedBadge
} from './SimulationSummary.styled'

type Translate = (key: string, opts?: Record<string, string | number>) => string

const shortenAddress = (address: string | null): string => {
  if (!address) return ''
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

const counterpartyLabel = (address: string | null, profiles: Record<string, string>): string => {
  if (!address) return ''
  return profiles[address.toLowerCase()] || shortenAddress(address)
}

// Groups the integer part of a numeric string with thousands separators, e.g. "1000000" → "1,000,000".
const groupThousands = (intPart: string): string => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Formats a decimal token amount for display: thousands separators, trailing zeros trimmed, and
// lossless (works on the string, never through Number, so big/precise amounts aren't rounded).
const formatTokenAmount = (raw: string): string => {
  if (!/^\d+(\.\d+)?$/.test(raw)) return raw
  const [intPart, decPart] = raw.split('.')
  const grouped = groupThousands(intPart)
  if (!decPart) return grouped
  const trimmed = decPart.replace(/0+$/, '')
  return trimmed ? `${grouped}.${trimmed}` : grouped
}

const formatUsd = (dollarValue: string | null, signed = false): string | null => {
  if (dollarValue === null) return null
  const value = Number(dollarValue)
  if (!Number.isFinite(value)) return null
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.')
  const magnitude = `$${groupThousands(intPart)}.${decPart}`
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
  // `rawAmount` is in base units (e.g. wei), so it's only a valid display amount when the token
  // has 0 decimals. Otherwise, without a decimals-applied `amount`, we show the symbol alone
  // rather than a base-unit number inflated by ~18 orders of magnitude.
  let displayAmount: string | null = null
  if (change.amount) displayAmount = formatTokenAmount(change.amount)
  else if (change.rawAmount && change.decimals === 0) displayAmount = formatTokenAmount(change.rawAmount)
  if (displayAmount && symbol) return `${displayAmount} ${symbol}`
  if (displayAmount) return displayAmount
  if (symbol) return symbol
  return t('request.transaction_dialog.unknown_token', { address: shortenAddress(change.contractAddress) })
}

/** Renders `label` as a block-explorer link (or plain text), with a verified badge when the
 *  address is a recognized Decentraland contract. */
const AddressLink = ({
  address,
  chainId,
  label,
  verified
}: {
  address: string | null
  chainId?: number
  label: string
  verified?: boolean
}) => {
  const { t } = useTranslation()
  const url = getExplorerAddressUrl(chainId, address)
  const badge = verified ? (
    <VerifiedBadge aria-label={t('request.transaction_dialog.verified_contract')}>✓ Decentraland</VerifiedBadge>
  ) : null
  if (!url) {
    return (
      <>
        {label}
        {badge}
      </>
    )
  }
  return (
    <>
      <ExplorerLink
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={t('request.transaction_dialog.view_on_explorer', { explorer: getExplorerName(chainId) })}
      >
        {label}
      </ExplorerLink>
      {badge}
    </>
  )
}

const AssetRow = ({
  change,
  direction,
  profiles,
  verified,
  chainId
}: {
  change: AssetChange
  direction: 'send' | 'receive'
  profiles: Record<string, string>
  verified: Set<string>
  chainId?: number
}) => {
  const { t } = useTranslation()
  const title = assetTitle(change, t)
  const dollar = formatUsd(change.dollarValue)
  const fallbackInitial = (change.symbol || change.name || '?').charAt(0)
  const outgoing = direction === 'send'
  const isVerified = (address: string | null) => !!address && verified.has(address.toLowerCase())

  let meta: React.ReactNode
  if (change.type === 'mint') {
    meta = t('request.transaction_dialog.minted')
  } else if (change.type === 'burn') {
    meta = t('request.transaction_dialog.burned')
  } else {
    const counterparty = outgoing ? change.to : change.from
    meta = (
      <>
        {outgoing ? t('request.transaction_dialog.to_prefix') : t('request.transaction_dialog.from_prefix')}{' '}
        <AddressLink
          address={counterparty}
          chainId={chainId}
          label={counterpartyLabel(counterparty, profiles)}
          verified={isVerified(counterparty)}
        />
      </>
    )
  }

  return (
    <ChangeRow>
      <DirectionIndicator outgoing={outgoing} aria-hidden="true">
        {outgoing ? '↑' : '↓'}
      </DirectionIndicator>
      {change.logoUrl ? (
        <TokenLogo src={change.logoUrl} alt={title} />
      ) : (
        <TokenLogoFallback aria-hidden="true">{fallbackInitial}</TokenLogoFallback>
      )}
      <ChangeText>
        <ChangeAmount>
          <AddressLink address={change.contractAddress} chainId={chainId} label={title} verified={isVerified(change.contractAddress)} />
        </ChangeAmount>
        <ChangeMeta>{meta}</ChangeMeta>
      </ChangeText>
      {dollar ? <AmountUsd>≈ {dollar}</AmountUsd> : null}
    </ChangeRow>
  )
}

const ApprovalItem = ({
  approval,
  profiles,
  verified,
  chainId
}: {
  approval: ApprovalChange
  profiles: Record<string, string>
  verified: Set<string>
  chainId?: number
}) => {
  const { t } = useTranslation()
  const token = approval.name || approval.symbol || shortenAddress(approval.contractAddress)
  const spenderVerified = !!approval.spender && verified.has(approval.spender.toLowerCase())
  const spender = (
    <AddressLink
      address={approval.spender}
      chainId={chainId}
      label={counterpartyLabel(approval.spender, profiles)}
      verified={spenderVerified}
    />
  )

  let predicate: string
  let highRisk = false
  if (approval.kind === 'approvalForAll') {
    if (approval.approved === false) {
      predicate = t('request.transaction_dialog.approval_access_revoked', { name: token })
    } else {
      predicate = t('request.transaction_dialog.approval_can_access_all', { name: token })
      highRisk = true
    }
  } else if (approval.tokenId) {
    predicate = t('request.transaction_dialog.approval_can_transfer_token', { token, tokenId: approval.tokenId })
  } else {
    const symbol = approval.symbol || token
    // Never show `rawAmount` (base units) here — approvals carry no decimals, so an unformatted
    // finite allowance would render as a huge misleading number. Show the decimals-applied
    // `amount` when the server provides it; otherwise state the permission without a figure.
    if (approval.isUnlimited) {
      predicate = t('request.transaction_dialog.approval_can_spend', { amount: t('request.transaction_dialog.approval_unlimited'), symbol })
    } else if (approval.amount) {
      predicate = t('request.transaction_dialog.approval_can_spend', { amount: formatTokenAmount(approval.amount), symbol })
    } else {
      predicate = t('request.transaction_dialog.approval_can_spend_symbol', { symbol })
    }
    highRisk = approval.isUnlimited
  }

  return (
    <ApprovalLine emphasized={highRisk}>
      {highRisk ? <RiskIcon aria-hidden="true">⚠</RiskIcon> : null}
      {spender} {predicate}
    </ApprovalLine>
  )
}

const NetChange = ({ result, userAddress, t }: { result: SimulationResponseBody; userAddress: string; t: Translate }) => {
  const net = (result.balanceChanges ?? []).find(change => change.address.toLowerCase() === userAddress && change.dollarValue !== null)
  const formatted = net ? formatUsd(net.dollarValue, true) : null
  if (!formatted) return null
  return (
    <NetLine>
      {t('request.transaction_dialog.net_change')}
      <NetValue negative={formatted.startsWith('-')}>{formatted}</NetValue>
    </NetLine>
  )
}

const TechnicalDetails = ({
  events,
  verified,
  chainId,
  t
}: {
  events: SimulationResponseBody['events']
  verified: Set<string>
  chainId?: number
  t: Translate
}) => {
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
              {event.name || t('request.transaction_dialog.event_unknown')} ·{' '}
              <AddressLink
                address={event.address}
                chainId={chainId}
                label={shortenAddress(event.address)}
                verified={verified.has(event.address.toLowerCase())}
              />
            </EventRow>
          ))}
        </EventList>
      ) : null}
    </>
  )
}

export const SimulationSummary = ({ simulation, userAddress, profiles = {}, verifiedContracts = [], chainId }: SimulationSummaryProps) => {
  const { t } = useTranslation()
  const verified = new Set(verifiedContracts.map(address => address.toLowerCase()))

  if (simulation.status === 'idle') return null

  if (simulation.status === 'loading') {
    return (
      <Root aria-busy="true" aria-label={t('request.transaction_dialog.simulation_loading')}>
        {[0, 1].map(index => (
          <SkeletonRow key={`skeleton-${index}`}>
            <Skeleton variant="circular" width={40} height={40} />
            <ChangeText>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </ChangeText>
          </SkeletonRow>
        ))}
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
  const networkName = getNetworkName(chainId)

  return (
    <Root>
      {networkName ? <NetworkChip>{t('request.transaction_dialog.on_network', { network: networkName })}</NetworkChip> : null}

      {result.status === 'reverted' ? (
        <Alert severity="error" role="alert">
          <strong>{t('request.transaction_dialog.revert_title')}</strong>
          <div>{t('request.transaction_dialog.revert_description', { reason: result.error ? `: ${result.error}` : '' })}</div>
        </Alert>
      ) : null}

      {sends.length > 0 ? (
        <Section>
          <SectionTitle role="heading" aria-level={3}>
            {t('request.transaction_dialog.you_send')}
          </SectionTitle>
          {sends.map((change, index) => (
            <AssetRow key={`send-${index}`} change={change} direction="send" profiles={profiles} verified={verified} chainId={chainId} />
          ))}
        </Section>
      ) : null}

      {receives.length > 0 ? (
        <Section>
          <SectionTitle role="heading" aria-level={3}>
            {t('request.transaction_dialog.you_receive')}
          </SectionTitle>
          {receives.map((change, index) => (
            <AssetRow
              key={`receive-${index}`}
              change={change}
              direction="receive"
              profiles={profiles}
              verified={verified}
              chainId={chainId}
            />
          ))}
        </Section>
      ) : null}

      <NetChange result={result} userAddress={user} t={t} />

      {result.approvalChanges.length > 0 ? (
        <ApprovalsAlert severity="warning" role="alert">
          <SectionTitle role="heading" aria-level={3}>
            {t('request.transaction_dialog.approvals_title')}
          </SectionTitle>
          {result.approvalChanges.map((approval, index) => (
            <ApprovalItem key={`approval-${index}`} approval={approval} profiles={profiles} verified={verified} chainId={chainId} />
          ))}
        </ApprovalsAlert>
      ) : null}

      {hasNoChanges && result.status !== 'reverted' ? (
        <UnavailableNote>{t('request.transaction_dialog.no_changes')}</UnavailableNote>
      ) : null}

      <TechnicalDetails events={result.events ?? []} verified={verified} chainId={chainId} t={t} />
    </Root>
  )
}
