import { formatEther } from 'viem'
import { useTranslation } from '@dcl/hooks'
import type { CreditsPurchasePricing } from '../../types'
import { CreditsMark } from './CreditsMark'
import { Price, PriceNote, PriceRow } from './CreditsPurchase.styled'

/**
 * The price line of a credits purchase: the credits mark and the amount the balance is charged, and — for an
 * item priced in MANA — the MANA price under it, with how it was turned into credits.
 *
 * The amount is always the charge the ledger holds, verified against the signed price, so it is written as
 * a plain number either way. What is not exact for a MANA-priced item is the relation between its MANA price
 * and credits, which depends on the day's rate; the note says so rather than putting a "≈" on the charge.
 */
const CreditsPurchasePrice = ({
  pricing,
  testIdPrefix,
  showNote = true
}: {
  pricing: CreditsPurchasePricing
  testIdPrefix: string
  showNote?: boolean
}) => {
  const { t } = useTranslation()
  const credits = pricing.credits.toString()
  return (
    <>
      <PriceRow>
        <CreditsMark size={32} data-testid={`${testIdPrefix}-mark`} />
        <Price data-testid={`${testIdPrefix}-price`} data-pricing={pricing.kind}>
          {t('credits_purchase.confirm.price', { credits })}
        </Price>
      </PriceRow>
      {pricing.kind === 'converted' && showNote ? (
        <PriceNote data-testid={`${testIdPrefix}-price-note`}>
          {t('credits_purchase.confirm.priced_in_mana', { mana: formatEther(pricing.manaWei) })}
        </PriceNote>
      ) : null}
    </>
  )
}

export { CreditsPurchasePrice }
