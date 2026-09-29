import { memo } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Box } from 'decentraland-ui2'
import { TransferLayout, TransferSecondaryText } from '../../../../Transfer'
import { CreditsPurchaseItem } from './CreditsPurchaseItem'
import { CreditsPurchasePrice } from './CreditsPurchasePrice'
import { CreditsPurchaseOutcomeViewProps, SignatureDelivery } from './CreditsPurchase.types'
import { PriceLabel, PurchaseContent, PurchaseFacts, PurchaseTitle } from './CreditsPurchase.styled'

/**
 * How a purchase review ended, in the words the end actually deserves.
 *
 * A refusal is the whole story: nothing was signed and nothing will happen. A signature is not. Auth signs
 * the meta-transaction and hands it back to the app that asked; the app is what submits it to the relay,
 * waits for the chain and knows whether the item arrived. So the signed screen says a signature was sent and
 * points the user back at the app, and it never claims the purchase settled, the credits were spent, or the
 * item is theirs — none of which this page can know.
 */
// What the screen says about a signature that exists, for each thing that may have become of it. The keys
// are separate rather than one hedged sentence because the three are genuinely different situations for the
// user: one to wait through, one that is done, and one where the app never got it and re-approving would be
// the wrong instinct.
const DELIVERY_KEYS: Readonly<Record<SignatureDelivery, { title: string; description: string }>> = {
  delivering: { title: 'credits_purchase.signed.title_delivering', description: 'credits_purchase.signed.description_delivering' },
  delivered: { title: 'credits_purchase.signed.title', description: 'credits_purchase.signed.description' },
  failed: { title: 'credits_purchase.signed.title_failed', description: 'credits_purchase.signed.description_failed' }
}

const CreditsPurchaseOutcomeView = memo(({ purchaseData, outcome, delivery = 'delivering' }: CreditsPurchaseOutcomeViewProps) => {
  const { t } = useTranslation()
  const isSigned = outcome === 'signed'
  const signedCopy = DELIVERY_KEYS[delivery]

  return (
    <TransferLayout scrollable>
      <PurchaseContent>
        <PurchaseTitle data-testid="credits-purchase-outcome-title">
          {t(isSigned ? signedCopy.title : 'credits_purchase.canceled.title')}
        </PurchaseTitle>
        <TransferSecondaryText>
          <Box data-testid="credits-purchase-outcome-description">
            {t(isSigned ? signedCopy.description : 'credits_purchase.canceled.description')}
          </Box>
        </TransferSecondaryText>
        <CreditsPurchaseItem purchaseData={purchaseData} />
        <PurchaseFacts>
          <PriceLabel>{t(isSigned ? 'credits_purchase.signed.price_label' : 'credits_purchase.canceled.price_label')}</PriceLabel>
          <CreditsPurchasePrice pricing={purchaseData.pricing} testIdPrefix="credits-purchase-outcome" showNote={false} />
        </PurchaseFacts>
      </PurchaseContent>
    </TransferLayout>
  )
})

export { CreditsPurchaseOutcomeView }
