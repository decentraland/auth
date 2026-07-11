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
  onDeny: () => void
  onApprove: () => void
}
