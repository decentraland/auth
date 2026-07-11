import { SimulationState } from '../../types'

export interface SimulationSummaryProps {
  simulation: SimulationState
  userAddress: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Lowercased addresses recognized as verified Decentraland contracts. */
  verifiedContracts?: string[]
  /** Chain the transaction was simulated on, used to build block-explorer links. */
  chainId?: number
}
