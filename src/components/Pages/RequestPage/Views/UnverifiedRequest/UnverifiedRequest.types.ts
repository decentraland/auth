import type { RequestClassification } from '../../classifyRequest'
import { GasEstimateState, ReviewRestartedNotice } from '../../types'

/** The request kinds shown by the unverified view: everything that is not a Decentraland contract call. */
type UnverifiedRequestKind = Exclude<RequestClassification['kind'], 'dcl_transaction' | 'dcl_meta_transaction'>

/** What the wallet will be handed, verbatim, for the Advanced tab. */
type UnverifiedRequestPayload =
  | { kind: 'transaction'; to: string; data: string; value: string }
  | {
      kind: 'typed_data'
      /** The typed data exactly as the request sent it. */
      raw: string
    }
  | {
      kind: 'message'
      /** The bytes the wallet signs. */
      hex: string
      /** The bytes decoded as text, or null when they are not readable text. */
      text: string | null
    }

interface UnverifiedRequestViewProps {
  requestId: string
  kind: UnverifiedRequestKind
  method: string
  /** The contract or recipient the request targets, when it names one. */
  targetAddress?: string | null
  /** True when the target is the connected account (a self-send). */
  targetIsSelf?: boolean
  /** The chain the request executes on, or the one its typed data is bound to. */
  chainId?: number | null
  /** Native value carried by a transaction, as a hex quantity. */
  nativeValue?: string
  /** Transactions only: the wallet-side fee estimate. */
  gas?: GasEstimateState
  /** The user's native balance in wei, shown next to the fee. */
  balance?: bigint
  payload: UnverifiedRequestPayload
  /**
   * True while the review may not be acted on. The page holds every gate in one place — the fee is known
   * and the acknowledgment was given for this exact payload — and its approval handler enforces the same
   * value, so no button can approve a review the gates have not cleared (see isReviewActionable in
   * RequestPage). This view adds one gate of its own, for what only it can measure: a long message must
   * have been scrolled to its end before the checkbox is even enabled.
   */
  approveBlocked?: boolean
  /** Whether the acknowledgment has been given for the payload on display. Owned by the page. */
  acknowledged?: boolean
  onAcknowledgedChange?: (checked: boolean) => void
  /**
   * Addresses this request reaches that had no code when they were checked. A simple transfer is only
   * simple while its recipient stays empty, and the requester that chose the address can deploy to it
   * before the transfer executes; when there are any, the view says so and asks a consent of its own,
   * separate from the risk acknowledgment.
   */
  callbackAddresses?: string[]
  /** Whether that consent has been given for the payload on display. Owned by the page. */
  callbackAcknowledged?: boolean
  onCallbackAcknowledgedChange?: (checked: boolean) => void
  isLoading?: boolean
  /** Why this review replaced an earlier one, when it did. Null when it is the first review. */
  reviewRestartedReason?: ReviewRestartedNotice | null
  onDeny: () => void
  onApprove: () => void
}

export type { UnverifiedRequestKind, UnverifiedRequestPayload, UnverifiedRequestViewProps }
