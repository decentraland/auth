import type { CreditsPurchaseData } from '../../types'

type CreditsPurchaseViewProps = {
  purchaseData: CreditsPurchaseData
  /** The chain the purchase settles on, for the block-explorer links in the details. */
  chainId?: number
  /** An approval this page is already running (see RequestPage's isBusy). */
  isLoading?: boolean
  /** Whether the page's gates allow this review to be approved (see isReviewActionable). */
  approveBlocked?: boolean
  /** Addresses this call reaches that had no code when they were checked, and may have some when it runs. */
  callbackAddresses?: string[]
  callbackAcknowledged?: boolean
  onCallbackAcknowledgedChange?: (acknowledged: boolean) => void
  onDeny: () => void
  onApprove: () => void | Promise<void>
}

/**
 * How a purchase review ended. `canceled` is the user's own refusal; `signed` is the signature Auth produced
 * and handed back — which is not the purchase, and the screen says so.
 */
type CreditsPurchaseOutcome = 'canceled' | 'signed'

/**
 * What became of a signature the wallet produced. Creating one and getting it back to the app are two
 * events, and the second can fail on its own, so the screen reports them apart.
 */
type SignatureDelivery = 'delivering' | 'delivered' | 'failed'

type CreditsPurchaseOutcomeViewProps = {
  purchaseData: CreditsPurchaseData
  outcome: CreditsPurchaseOutcome
  /** Only meaningful for `signed`; a cancellation delivers nothing. */
  delivery?: SignatureDelivery
}

export type { CreditsPurchaseOutcome, CreditsPurchaseOutcomeViewProps, CreditsPurchaseViewProps, SignatureDelivery }
