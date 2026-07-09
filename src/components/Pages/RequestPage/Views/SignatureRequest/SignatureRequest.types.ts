import { SignaturePayload, SimulationState } from '../../types'

export interface SignatureRequestViewProps {
  requestId: string
  method: string
  payload: SignaturePayload | null
  simulation: SimulationState
  userAddress: string
  isMetaTransaction: boolean
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
