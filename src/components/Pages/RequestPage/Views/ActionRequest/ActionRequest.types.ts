/** What the wallet will be handed, verbatim. */
type ActionRequestPayload =
  | {
      kind: 'transaction'
      to: string
      data: string
      /** Hex quantity, as the wallet is handed it. */
      value: string
      /** The chain the transaction executes on. */
      chainId: number
    }
  | {
      kind: 'typed_data'
      /** The typed data exactly as the wallet will read it. */
      raw: string
    }
  | {
      kind: 'message'
      /** The bytes the wallet signs. */
      hex: string
      /** The bytes decoded as text, or null when they are not readable text. */
      text: string | null
    }

interface ActionRequestViewProps {
  requestId: string
  payload: ActionRequestPayload
  /**
   * True while the review may not be acted on. The page holds every gate in one place — the acknowledgment
   * was given for this exact payload, the fee is known where the user pays it — and its approval handler
   * enforces the same value, so no button can approve a review the gates have not cleared (see
   * isReviewActionable in RequestPage).
   */
  approveBlocked?: boolean
  /** Whether the acknowledgment has been given for the payload on display. Owned by the page. */
  acknowledged?: boolean
  onAcknowledgedChange?: (checked: boolean) => void
  isLoading?: boolean
  /** True when this review replaced one invalidated because the wallet's network changed. */
  reviewRestarted?: boolean
  onDeny: () => void
  onApprove: () => void
}

export type { ActionRequestPayload, ActionRequestViewProps }
