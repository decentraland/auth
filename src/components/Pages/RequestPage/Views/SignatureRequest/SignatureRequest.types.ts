import { SignaturePayload, SimulationState } from '../../types'

export interface SignatureRequestViewProps {
  requestId: string
  method: string
  payload: SignaturePayload | null
  simulation: SimulationState
  userAddress: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  isMetaTransaction: boolean
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
