import { PreviewCaveat, SimulationState } from '../../types'

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
  /** Chain used for block-explorer links. */
  chainId?: number
  /** When true, the approve button is gated behind a high-risk acknowledgment checkbox. */
  requiresAcknowledgment?: boolean
  /** Why the preview cannot be vouched for even though it ran (see PreviewCaveat), or null. */
  previewCaveat?: PreviewCaveat | null
  /** True while whether the preview can be vouched for is still being decided; Allow waits for it. */
  isPreviewCaveatPending?: boolean
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
