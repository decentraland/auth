import { SimulationState } from '../../types'

export interface TransactionConfirmDialogProps {
  open: boolean
  transactionCost: bigint
  balance: bigint
  simulation: SimulationState
  userAddress: string
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}
