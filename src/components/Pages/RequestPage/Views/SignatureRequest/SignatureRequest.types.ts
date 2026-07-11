import { SignaturePayload, SimulationState } from '../../types'

export interface SignatureRequestViewProps {
  requestId: string
  method: string
  payload: SignaturePayload | null
  simulation: SimulationState
  userAddress: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Lowercased addresses recognized as verified Decentraland contracts. */
  verifiedContracts?: string[]
  /** Chain used for block-explorer links (falls back to the typed-data domain chainId). */
  chainId?: number
  /** When true, gates approval behind a high-risk acknowledgment checkbox. */
  requiresAcknowledgment?: boolean
  isMetaTransaction: boolean
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
