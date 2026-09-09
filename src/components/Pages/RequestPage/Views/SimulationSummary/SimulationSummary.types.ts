import { SimulationState } from '../../types'

export interface SimulationSummaryProps {
  simulation: SimulationState
  userAddress: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Lowercased addresses of registry contracts: Decentraland's own, shown with the verified badge. */
  verifiedContracts?: string[]
  /**
   * Lowercased addresses of collections a Decentraland factory deployed: Decentraland code carrying
   * content anyone can create, so they are labelled as collections, neither verified nor unverified.
   */
  collectionContracts?: string[]
  /** Chain the transaction was simulated on, used to build block-explorer links. */
  chainId?: number
  /**
   * Optional gas footer, grouped inside the summary. Only transaction reviews pass it; signature
   * previews (which are gasless) omit it. `cost`/`balance` are pre-formatted amounts in the chain's
   * native currency; the balance is omitted when the wallet could not report it.
   */
  gas?: {
    covered: boolean
    cost: string
    balance?: string
    /** True when the user pays gas but the wallet could not estimate it. */
    unavailable?: boolean
  }
}
