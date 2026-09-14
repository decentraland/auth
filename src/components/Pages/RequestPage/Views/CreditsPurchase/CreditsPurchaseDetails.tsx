import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import { muiIcons } from 'decentraland-ui2'
import { getNetworkName } from '../../../../../shared/explorer'
import type { CreditsPurchaseData } from '../../types'
import { DetailLabel, DetailRow, DetailValue, DetailsAccordion, DetailsBody, DetailsSummary } from './CreditsPurchase.styled'

/** A unix timestamp in seconds as a local date and time, or the raw number when it cannot be formatted. */
function formatTimestamp(seconds: bigint): string {
  const milliseconds = Number(seconds) * 1000
  if (!Number.isFinite(milliseconds)) return seconds.toString()
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? seconds.toString() : date.toLocaleString()
}

/**
 * Everything the summary above leaves out, folded away: the contracts the call reaches, the amounts in the
 * units they are signed in, and when the authorization stops being valid.
 *
 * Two of these are here because naming them wrongly is exactly how a purchase screen lies. The price is
 * signed in USD wei and the credits above are that number divided by the peg — both are shown, so the
 * arithmetic can be checked. The MANA cap is the most the CreditsManager may draw from the credit to settle
 * the trade; it is a different quantity in a different unit, and it is labelled as MANA so it can never be
 * read as what the purchase costs.
 */
const CreditsPurchaseDetails = ({ purchaseData, chainId }: { purchaseData: CreditsPurchaseData; chainId?: number }) => {
  const { t } = useTranslation()
  const { purchase } = purchaseData
  const { asset } = purchase
  const network = getNetworkName(chainId)

  const rows: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'collection',
      label: t(asset.kind === 'collection_item' ? 'credits_purchase.details.collection' : 'credits_purchase.details.token_contract'),
      value: asset.contractAddress
    },
    {
      key: 'asset-id',
      label: t(asset.kind === 'collection_item' ? 'credits_purchase.details.item_id' : 'credits_purchase.details.token_id'),
      value: asset.kind === 'collection_item' ? asset.itemId : asset.tokenId
    },
    { key: 'recipient', label: t('credits_purchase.details.recipient'), value: purchase.recipient },
    { key: 'seller', label: t('credits_purchase.details.seller'), value: purchase.seller },
    { key: 'payment-beneficiary', label: t('credits_purchase.details.payment_beneficiary'), value: purchase.paymentBeneficiary },
    { key: 'price-usd-wei', label: t('credits_purchase.details.price_usd_wei'), value: purchase.priceUsdWei.toString() },
    {
      key: 'max-credited',
      label: t('credits_purchase.details.max_credited_mana'),
      value: `${formatEther(purchase.maxCreditedValueWei)} MANA`
    },
    { key: 'credits-manager', label: t('credits_purchase.details.credits_manager'), value: purchase.creditsManagerAddress },
    { key: 'marketplace', label: t('credits_purchase.details.marketplace'), value: purchase.marketplaceAddress },
    { key: 'payment-token', label: t('credits_purchase.details.payment_token'), value: purchase.paymentTokenAddress },
    { key: 'expires', label: t('credits_purchase.details.expires_at'), value: formatTimestamp(purchase.externalCallExpiresAt) },
    { key: 'trade-expires', label: t('credits_purchase.details.trade_expires_at'), value: formatTimestamp(purchase.tradeExpiresAt) },
    ...(network ? [{ key: 'network', label: t('credits_purchase.details.network'), value: network }] : [])
  ]

  return (
    <DetailsAccordion disableGutters data-testid="credits-purchase-details">
      <DetailsSummary expandIcon={<muiIcons.ExpandMore />}>{t('credits_purchase.details.title')}</DetailsSummary>
      <DetailsBody>
        {rows.map(row => (
          <DetailRow key={row.key} data-testid={`credits-purchase-detail-${row.key}`}>
            <DetailLabel>{row.label}</DetailLabel>
            <DetailValue>{row.value}</DetailValue>
          </DetailRow>
        ))}
      </DetailsBody>
    </DetailsAccordion>
  )
}

export { CreditsPurchaseDetails, formatTimestamp }
