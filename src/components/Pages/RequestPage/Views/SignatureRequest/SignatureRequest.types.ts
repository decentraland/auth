import { MetaTransactionContractTrust, SignaturePayload, SimulationState, UnverifiableSignatureReason } from '../../types'

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
  /**
   * For a meta-transaction, whether its verifying contract is a recognized Decentraland contract.
   * Approval stays disabled while `pending`; `unconfirmed` adds a warning and reuses the unverified
   * acknowledgment wording. Recognition never relaxes anything.
   */
  contractTrust?: MetaTransactionContractTrust
  /**
   * Set when Auth cannot tell what the signature authorizes (an unrecognized typed-data struct, or
   * a message that is not readable text). Shows a notice and uses the unverified acknowledgment.
   */
  unverifiableReason?: UnverifiableSignatureReason | null
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
