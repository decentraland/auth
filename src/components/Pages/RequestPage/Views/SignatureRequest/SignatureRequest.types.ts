import { SimulationState } from '../../types'

/** The review of a Decentraland MetaTransaction signature: the decoded inner call and its simulation. */
export interface SignatureRequestViewProps {
  requestId: string
  method: string
  /** The typed data exactly as the request sent it, shown behind the raw toggle. */
  raw: string
  /** The Decentraland contract that verifies the signature and executes the call (lowercased). */
  verifyingContract: string
  /** The function the inner calldata decodes to against the contract's ABI. */
  functionName: string
  /** The Decentraland contract, as the registry names it. */
  contractName: string
  simulation: SimulationState
  userAddress: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Lowercased addresses recognized as verified Decentraland contracts. */
  verifiedContracts?: string[]
  /** Lowercased addresses of collections a Decentraland factory deployed (see SimulationSummaryProps). */
  collectionContracts?: string[]
  /** Chain the meta-transaction is bound to, used for block-explorer links. */
  chainId?: number
  /** When true, gates approval behind an acknowledgment checkbox. */
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
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
