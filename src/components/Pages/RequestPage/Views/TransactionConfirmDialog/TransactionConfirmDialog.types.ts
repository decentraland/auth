import { SimulationState } from '../../types'

export interface TransactionConfirmDialogProps {
  open: boolean
  transactionCost: bigint
  balance: bigint
  simulation: SimulationState
  userAddress: string
  /** True when the transaction is relayed as a meta-transaction and gas is paid by Decentraland. */
  gasCovered?: boolean
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}
