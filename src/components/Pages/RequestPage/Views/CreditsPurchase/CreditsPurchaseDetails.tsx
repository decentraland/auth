import { formatEther, formatUnits } from 'viem'
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
 * shown in the unit it is signed in: USD wei, which the credits above divide by the peg, or MANA, which the
 * credits above convert at the rate listed with it — either way the arithmetic can be checked. The MANA cap is the most the CreditsManager may draw from the credit to settle
 * the trade; it is a different quantity in a different unit, and it is labelled as MANA so it can never be
 * read as what the purchase costs.
 */
const CreditsPurchaseDetails = ({ purchaseData, chainId }: { purchaseData: CreditsPurchaseData; chainId?: number }) => {
  const { t } = useTranslation()
  const { purchase } = purchaseData
  const { asset } = purchase
  const network = getNetworkName(chainId)

  const {
    pricing,
    purchase: { price }
  } = purchaseData
  const optional = (key: string, label: string, value: string | null) => (value === null ? [] : [{ key, label, value }])

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
    ...optional('seller', t('credits_purchase.details.seller'), purchase.seller),
    ...optional('payment-beneficiary', t('credits_purchase.details.payment_beneficiary'), purchase.paymentBeneficiary),
    price.kind === 'usd_pegged'
      ? { key: 'price-usd-wei', label: t('credits_purchase.details.price_usd_wei'), value: price.usdWei.toString() }
      : { key: 'price-mana', label: t('credits_purchase.details.price_mana'), value: `${formatEther(price.manaWei)} MANA` },
    ...(pricing.kind === 'converted'
      ? [
          {
            key: 'mana-usd-rate',
            label: t('credits_purchase.details.mana_usd_rate'),
            value: `1 MANA = ${formatUnits(pricing.rate.rate, pricing.rate.decimals)} USD`
          }
        ]
      : []),
    {
      key: 'max-credited',
      label: t('credits_purchase.details.max_credited_mana'),
      value: `${formatEther(purchase.maxCreditedValueWei)} MANA`
    },
    { key: 'credits-manager', label: t('credits_purchase.details.credits_manager'), value: purchase.creditsManagerAddress },
    {
      key: 'settlement',
      label: t(purchase.via === 'collection_store' ? 'credits_purchase.details.collection_store' : 'credits_purchase.details.marketplace'),
      value: purchase.settlementAddress
    },
    { key: 'payment-token', label: t('credits_purchase.details.payment_token'), value: purchase.paymentTokenAddress },
    { key: 'expires', label: t('credits_purchase.details.expires_at'), value: formatTimestamp(purchase.externalCallExpiresAt) },
    ...optional(
      'trade-expires',
      t('credits_purchase.details.trade_expires_at'),
      purchase.tradeExpiresAt === null ? null : formatTimestamp(purchase.tradeExpiresAt)
    ),
    { key: 'credit-expires', label: t('credits_purchase.details.credit_expires_at'), value: formatTimestamp(purchase.creditExpiresAt) },
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
