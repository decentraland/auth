import { useTranslation } from '@dcl/hooks'
import { Alert, CircularProgress } from 'decentraland-ui2'
import { ApprovalChange, AssetChange } from '../../../../../shared/auth'
import { SimulationSummaryProps } from './SimulationSummary.types'
import {
  ApprovalLine,
  ApprovalsAlert,
  ChangeAmount,
  ChangeMeta,
  ChangeRow,
  ChangeText,
  LoadingRow,
  Root,
  Section,
  SectionTitle,
  TokenLogo,
  TokenLogoFallback,
  UnavailableNote
} from './SimulationSummary.styled'

const shortenAddress = (address: string | null): string => {
  if (!address) return ''
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

const assetTitle = (change: AssetChange, t: (key: string, opts?: Record<string, string | number>) => string): string => {
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

const AssetRow = ({ change, counterparty }: { change: AssetChange; counterparty: string | null }) => {
  const { t } = useTranslation()
  const title = assetTitle(change, t)
  const fallbackInitial = (change.symbol || change.name || '?').charAt(0)
  return (
    <ChangeRow>
      {change.logoUrl ? <TokenLogo src={change.logoUrl} alt={title} /> : <TokenLogoFallback>{fallbackInitial}</TokenLogoFallback>}
      <ChangeText>
        <ChangeAmount>{title}</ChangeAmount>
        {counterparty ? <ChangeMeta>{shortenAddress(counterparty)}</ChangeMeta> : null}
      </ChangeText>
    </ChangeRow>
  )
}

const ApprovalItem = ({ approval }: { approval: ApprovalChange }) => {
  const { t } = useTranslation()
  const token = approval.name || approval.symbol || shortenAddress(approval.contractAddress)
  const spender = shortenAddress(approval.spender)

  if (approval.kind === 'approvalForAll') {
    return <ApprovalLine emphasized>{t('request.transaction_dialog.approval_for_all', { spender, name: token })}</ApprovalLine>
  }

  const symbol = approval.tokenId ? `#${approval.tokenId}` : approval.symbol || token
  const amount = approval.isUnlimited ? t('request.transaction_dialog.approval_unlimited') : (approval.amount ?? approval.rawAmount ?? '')
  return (
    <ApprovalLine emphasized={approval.isUnlimited}>
      {t('request.transaction_dialog.approval_description', { spender, amount, symbol })}
    </ApprovalLine>
  )
}

export const SimulationSummary = ({ simulation, userAddress }: SimulationSummaryProps) => {
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
  // "Sends" are transfers leaving the user's account. Everything else (received assets and
  // any effects where the user is neither party) is grouped under "receives".
  const sends = result.assetChanges.filter(change => change.from?.toLowerCase() === user)
  const receives = result.assetChanges.filter(change => change.from?.toLowerCase() !== user)

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
            <AssetRow key={`send-${index}`} change={change} counterparty={change.to} />
          ))}
        </Section>
      ) : null}

      {receives.length > 0 ? (
        <Section>
          <SectionTitle>{t('request.transaction_dialog.you_receive')}</SectionTitle>
          {receives.map((change, index) => (
            <AssetRow key={`receive-${index}`} change={change} counterparty={change.from} />
          ))}
        </Section>
      ) : null}

      {result.approvalChanges.length > 0 ? (
        <ApprovalsAlert severity="warning">
          <SectionTitle>{t('request.transaction_dialog.approvals_title')}</SectionTitle>
          {result.approvalChanges.map((approval, index) => (
            <ApprovalItem key={`approval-${index}`} approval={approval} />
          ))}
        </ApprovalsAlert>
      ) : null}
    </Root>
  )
}
