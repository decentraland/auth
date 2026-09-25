import { useState } from 'react'
import { useTranslation } from '@dcl/hooks'
import { Checkbox, FormControlLabel } from 'decentraland-ui2'
import { TransferActionButtons, TransferLayout, TransferLoadingState } from '../../../../Transfer'
import { Notices, WarningAlert } from '../../../../Transfer/Transfer.styled'
import { CreditsMark } from './CreditsMark'
import { CreditsPurchaseDetails } from './CreditsPurchaseDetails'
import { CreditsPurchaseItem } from './CreditsPurchaseItem'
import { CreditsPurchaseViewProps } from './CreditsPurchase.types'
import { Price, PriceLabel, PriceRow, PurchaseContent, PurchaseFacts, PurchaseTitle, RecipientLabel } from './CreditsPurchase.styled'

/**
 * The approval for a credits purchase: what is being bought, what it costs in credits, where it is delivered,
 * and one decision.
 *
 * Every fact on it was read out of the bytes the signature covers, so what the user agrees to is what will
 * execute — the item is the one the trade sends, the credits are the signed USD price divided by the peg, and
 * the recipient is the account the trade delivers to, which the page has already proved is the reviewing
 * signer. The item's name and picture are the one part that comes from elsewhere (the catalyst), and they
 * name the item rather than deciding anything; when they are missing the item is named by its identifiers and
 * the screen is otherwise unchanged.
 *
 * What it deliberately does not say: that the purchase is done. Approving here produces a signature that Auth
 * hands back to the app, and the app is what submits it — see CreditsPurchaseOutcomeView.
 */
const CreditsPurchaseView = (props: CreditsPurchaseViewProps) => {
  const { t } = useTranslation()
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false)
  const { purchaseData } = props
  const { purchase } = purchaseData
  // Processing while the approval is being asked of the wallet, or while the page executes it. Not while a
  // confirmation dialog is open: onApprove resolves once it is shown, and cancelling it hands the buttons
  // back (see TransferConfirmView, which does the same).
  const isProcessing = isAwaitingApproval || props.isLoading
  const asksCallbackConsent = !isProcessing && (props.callbackAddresses?.length ?? 0) > 0

  const handleApprove = async () => {
    setIsAwaitingApproval(true)
    try {
      await props.onApprove()
    } finally {
      setIsAwaitingApproval(false)
    }
  }

  return (
    <TransferLayout scrollable>
      <PurchaseContent>
        <PurchaseTitle data-testid="credits-purchase-title">
          {isProcessing ? t('credits_purchase.confirm.processing_title') : t('credits_purchase.confirm.title')}
        </PurchaseTitle>
        <CreditsPurchaseItem purchaseData={purchaseData} />
        <PurchaseFacts>
          <PriceLabel>{t('credits_purchase.confirm.price_label')}</PriceLabel>
          <PriceRow>
            <CreditsMark size={32} data-testid="credits-purchase-mark" />
            <Price data-testid="credits-purchase-price">
              {t('credits_purchase.confirm.price', { credits: purchase.credits.toString() })}
            </Price>
          </PriceRow>
          <PriceLabel data-testid="credits-purchase-quantity">{t('credits_purchase.confirm.quantity')}</PriceLabel>
          <RecipientLabel data-testid="credits-purchase-recipient">
            {t('credits_purchase.confirm.delivered_to', { address: purchase.recipient })}
          </RecipientLabel>
        </PurchaseFacts>
        <CreditsPurchaseDetails purchaseData={purchaseData} chainId={props.chainId} />
        {asksCallbackConsent ? (
          <Notices data-testid="credits-purchase-notices">
            <WarningAlert severity="warning" data-testid="callback-code-warning">
              {t('request.transaction_dialog.callback_code_notice')}
            </WarningAlert>
            <FormControlLabel
              control={
                <Checkbox
                  checked={props.callbackAcknowledged ?? false}
                  onChange={event => props.onCallbackAcknowledgedChange?.(event.target.checked)}
                  data-testid="credits-purchase-callback-acknowledgment"
                />
              }
              label={t('request.transaction_dialog.acknowledge_callback_code')}
            />
          </Notices>
        ) : null}
        {isProcessing ? (
          <TransferLoadingState text={t('credits_purchase.confirm.processing')} />
        ) : (
          <TransferActionButtons
            isLoading={props.isLoading ?? false}
            confirmDisabled={props.approveBlocked}
            confirmText={t('credits_purchase.confirm.approve')}
            onCancel={props.onDeny}
            onConfirm={handleApprove}
          />
        )}
      </PurchaseContent>
    </TransferLayout>
  )
}

export { CreditsPurchaseView }
