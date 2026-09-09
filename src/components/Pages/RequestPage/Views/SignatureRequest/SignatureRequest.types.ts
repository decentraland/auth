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
  /** Chain the meta-transaction is bound to, used for block-explorer links. */
  chainId?: number
  /** When true, gates approval behind an acknowledgment checkbox. */
  requiresAcknowledgment?: boolean
  /**
   * True while it is still being decided whether every contract the inner call reaches is Decentraland's;
   * Allow waits for it. A call that reaches anything else is refused and never shown here.
   */
  isCounterpartyCheckPending?: boolean
  isLoading?: boolean
  onDeny: () => void
  onApprove: () => void
}
