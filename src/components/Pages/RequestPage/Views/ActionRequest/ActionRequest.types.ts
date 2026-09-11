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
      /**
       * True when Decentraland relays the call as a meta-transaction and covers the gas. The wallet is then
       * asked to sign typed data wrapping this call rather than to send it, so the block is worded as the
       * action that will be performed instead of as the bytes the wallet receives.
       */
      relayed?: boolean
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
   * The JSON-RPC method the wallet will be asked, as the request was recovered. Shown for the signing
   * methods, where the same JSON can be signed under `eth_signTypedData_v3` or `_v4` and only the method
   * tells the two wallet operations apart. A transaction omits it: its fields already say what it is, and
   * a relayed one reaches the wallet as a signature rather than under the method the request named.
   */
  method?: string
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
