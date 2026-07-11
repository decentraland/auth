import { SimulationState } from '../../types'

export interface WalletInteractionProps {
  requestId: string
  isWeb2Wallet?: boolean
  explorerText?: string
  isLoading?: boolean
  /** Asset-change simulation shown inline on this (first) screen for web2 users. */
  simulation?: SimulationState
  userAddress?: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Lowercased addresses recognized as verified Decentraland contracts. */
  verifiedContracts?: string[]
  /** Chain used for block-explorer links. */
  chainId?: number
  /** When true, the approve button is gated behind a high-risk acknowledgment checkbox. */
  requiresAcknowledgment?: boolean
  /** True when the transaction is relayed as a meta-transaction (gas paid by the gas tank). */
  gasCovered?: boolean
  /** Estimated gas cost in wei, shown inline when the user pays their own gas. */
  transactionCost?: bigint
  /** User's native balance in wei, shown next to the gas cost. */
  balance?: bigint
  /** True when the simulation predicts the transaction would revert. */
  isReverted?: boolean
  onDeny: () => void
  onApprove: () => void
}
