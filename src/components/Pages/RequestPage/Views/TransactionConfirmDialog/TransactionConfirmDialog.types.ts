import { SimulationState } from '../../types'

export interface TransactionConfirmDialogProps {
  open: boolean
  transactionCost: bigint
  balance: bigint
  simulation: SimulationState
  userAddress: string
  /** Resolved counterparty display names keyed by lowercased address. */
  profiles?: Record<string, string>
  /** Chain the transaction was simulated on, for block-explorer links. */
  chainId?: number
  /** True when the transaction is relayed as a meta-transaction and gas is paid by Decentraland. */
  gasCovered?: boolean
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}
