import { SimulationState } from '../../types'

/** What the review says about gas: covered by the relay, or the wallet's own fee estimate. */
type WalletInteractionGas =
  | { covered: true }
  | { covered: false; status: 'loading' }
  | { covered: false; status: 'unavailable' }
  | { covered: false; status: 'ready'; cost: bigint; balance?: bigint }

interface WalletInteractionProps {
  requestId: string
  isLoading?: boolean
  /** The function the calldata decodes to against the Decentraland contract's ABI. */
  functionName: string
  /** The Decentraland contract being called, as the registry names it. */
  contractName: string
  /** Asset-change simulation of the call, shown inline on this screen. */
  simulation: SimulationState
  userAddress?: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Lowercased addresses recognized as verified Decentraland contracts. */
  verifiedContracts?: string[]
  /** Lowercased addresses of collections a Decentraland factory deployed (see SimulationSummaryProps). */
  collectionContracts?: string[]
  /** Chain used for block-explorer links. */
  chainId?: number
  /** When true, the approve button is gated behind a high-risk acknowledgment checkbox. */
  requiresAcknowledgment?: boolean
  /**
   * True while the review may not be acted on. The page holds every gate in one place — the preview has
   * settled, the contracts the call reaches were checked, the fee is known, the acknowledgment was given
   * for this exact screen — and its approval handler enforces the same value, so no button can approve a
   * review the gates have not cleared (see isReviewActionable in RequestPage).
   */
  approveBlocked?: boolean
  /** Whether the acknowledgment has been given for the screen on display. Owned by the page. */
  acknowledged?: boolean
  onAcknowledgedChange?: (checked: boolean) => void
  /**
   * Addresses the call hands the contract that had no code when they were checked. Code can be deployed
   * there before the transaction executes, so the preview cannot vouch for what would then run; when there
   * are any, the view says so and asks a consent of its own, separate from the risk acknowledgment.
   */
  deferredCallbackAddresses?: string[]
  /** Whether that consent has been given for the screen on display. Owned by the page. */
  deferredCallbackAcknowledged?: boolean
  onDeferredCallbackAcknowledgedChange?: (checked: boolean) => void
  gas: WalletInteractionGas
  /** True when the simulation predicts the transaction would revert. */
  isReverted?: boolean
  /**
   * True when this review replaced one that was invalidated because the wallet's network changed or
   * could not be verified. Shown as a notice so the user knows why the page reloaded.
   */
  reviewRestarted?: boolean
  onDeny: () => void
  onApprove: () => void
}

export type { WalletInteractionGas, WalletInteractionProps }
