import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Skeleton } from 'decentraland-ui2'
import {
  ApprovalChange,
  AssetChange,
  SimulationResponseBody,
  isApprovalRevocation,
  isDangerousApproval,
  isZeroAddress
} from '../../../../../shared/auth'
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
  GasFooter,
  GasNote,
  NetLine,
  NetValue,
  NetworkChip,
  RevertAlert,
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

// Defensive ceiling on decoded events rendered in the technical-details section. The server already
// caps events at 50; this guards the UI against an unexpectedly large or malformed response.
const MAX_DISPLAYED_EVENTS = 100

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
  // Parse and round from the plain-decimal string (rather than through Number) so a very large
  // integer part is never rounded away. Round half-up to cents, carrying with BigInt. Inputs that
  // aren't plain decimals (e.g. scientific notation) fall back to the Number-based path below.
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(dollarValue.trim())
  if (match) {
    const [, sign, intPart, fracPart = ''] = match
    let cents = Number((fracPart + '00').slice(0, 2))
    if ((fracPart[2] ?? '0') >= '5') cents += 1
    let intValue = BigInt(intPart)
    if (cents === 100) {
      cents = 0
      intValue += 1n
    }
    const magnitude = `$${groupThousands(intValue.toString())}.${String(cents).padStart(2, '0')}`
    if (!signed) return magnitude
    // Only mark as negative when the rounded value is actually non-zero, so a tiny negative that
    // rounds to zero doesn't render as a misleading "-$0.00".
    const isNegative = sign === '-' && !(intValue === 0n && cents === 0)
    return `${isNegative ? '-' : '+'}${magnitude}`
  }

  const value = Number(dollarValue)
  if (!Number.isFinite(value)) return null
  const fixed = Math.abs(value).toFixed(2)
  // toFixed switches to exponential notation for very large magnitudes (e.g. "1.5e+21"), which
  // can't be grouped cleanly; skip those rather than render a malformed amount.
  if (/e/i.test(fixed)) return null
  const [intPart, decPart] = fixed.split('.')
  const magnitude = `$${groupThousands(intPart)}.${decPart}`
  if (!signed) return magnitude
  // Only mark as negative when the rounded value is actually non-zero (mirrors the decimal path).
  return `${value < 0 && Number(fixed) !== 0 ? '-' : '+'}${magnitude}`
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

  const symbol = approval.symbol || token
  const isRevocation = isApprovalRevocation(approval)
  // A revocation to the zero address has no counterparty to name. A grant to the zero address is
  // still shown with its address: it is a grant to an unrecognized spender and is worded as one.
  const hasCounterparty = !(isRevocation && isZeroAddress(approval.spender))

  let predicate: string
  if (approval.kind === 'approvalForAll') {
    if (approval.approved === false) {
      predicate = t('request.transaction_dialog.approval_access_revoked', { name: token })
    } else {
      predicate = t('request.transaction_dialog.approval_can_access_all', { name: token })
    }
  } else if (isRevocation) {
    // Same rule the gate uses, so a revocation is never worded as a grant.
    if (approval.tokenId) {
      predicate = t('request.transaction_dialog.approval_token_approval_revoked', { token, tokenId: approval.tokenId })
    } else if (hasCounterparty) {
      predicate = t('request.transaction_dialog.approval_can_no_longer_spend', { symbol })
    } else {
      predicate = t('request.transaction_dialog.approval_allowance_revoked', { symbol })
    }
  } else if (approval.tokenId) {
    predicate = t('request.transaction_dialog.approval_can_transfer_token', { token, tokenId: approval.tokenId })
  } else {
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
  }

  // The page gates the Allow button on the same rule, so the warning and the checkbox always agree.
  const highRisk = isDangerousApproval(approval, address => verified.has(address.toLowerCase()))

  return (
    <ApprovalLine emphasized={highRisk}>
      {highRisk ? <RiskIcon aria-hidden="true">⚠</RiskIcon> : null}
      {hasCounterparty ? spender : null} {predicate}
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
  const displayedEvents = events.slice(0, MAX_DISPLAYED_EVENTS)
  return (
    <>
      <Toggle type="button" aria-expanded={open} onClick={() => setOpen(show => !show)}>
        {open ? t('request.transaction_dialog.hide_technical_details') : t('request.transaction_dialog.technical_details')}
      </Toggle>
      {open ? (
        <EventList data-testid="simulation-events">
          {displayedEvents.map((event, index) => (
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

export const SimulationSummary = ({
  simulation,
  userAddress,
  profiles = {},
  verifiedContracts = [],
  chainId,
  gas
}: SimulationSummaryProps) => {
  const { t } = useTranslation()
  const verified = new Set(verifiedContracts.map(address => address.toLowerCase()))

  // The gas footer comes from the wallet/meta-transaction check, not the Tenderly result, so it is
  // shown once the preview resolves (ready or unavailable) so the user always sees the gas cost (or
  // that gas is covered) before approving. It is intentionally omitted while loading, because the
  // meta-transaction check that determines "gas covered" may not have resolved yet — and approval
  // is disabled during loading regardless.
  const gasFooter = gas ? (
    <GasFooter>
      {gas.covered ? (
        <GasNote>{t('request.transaction_dialog.gas_covered')}</GasNote>
      ) : (
        <>
          <GasNote>{t('request.transaction_dialog.transaction_cost', { cost: gas.cost })}</GasNote>
          <GasNote>{t('request.transaction_dialog.your_balance', { balance: gas.balance })}</GasNote>
        </>
      )}
    </GasFooter>
  ) : null

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
        {gasFooter}
      </Root>
    )
  }

  const { result } = simulation
  const user = userAddress.toLowerCase()
  // "Sends" are assets leaving the user's account (transfers out, and burns whose `from` is the
  // user). "Receives" are assets arriving to the user (transfers in and mints whose `to` is the
  // user). A change where the user is neither party isn't shown as either, so an unrelated
  // third-party movement is never mislabelled as something the user receives.
  const sends = result.assetChanges.filter(change => change.from?.toLowerCase() === user)
  const receives = result.assetChanges.filter(change => change.from?.toLowerCase() !== user && change.to?.toLowerCase() === user)
  const hasNoChanges = sends.length === 0 && receives.length === 0 && result.approvalChanges.length === 0
  const networkName = getNetworkName(chainId)

  return (
    <Root>
      {networkName ? <NetworkChip>{t('request.transaction_dialog.on_network', { network: networkName })}</NetworkChip> : null}

      {result.status === 'reverted' ? (
        <RevertAlert severity="error" role="alert">
          <strong>{t('request.transaction_dialog.revert_title')}</strong>
          <div>{t('request.transaction_dialog.revert_description', { reason: result.error ? `: ${result.error}` : '' })}</div>
        </RevertAlert>
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

      {gasFooter}

      <TechnicalDetails events={result.events ?? []} verified={verified} chainId={chainId} t={t} />
    </Root>
  )
}
