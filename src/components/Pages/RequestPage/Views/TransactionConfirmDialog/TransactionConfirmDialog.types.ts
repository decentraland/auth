export interface TransactionConfirmDialogProps {
  open: boolean
  transactionCost: bigint
  balance: bigint
  /** True when the transaction is relayed as a meta-transaction and gas is paid by Decentraland. */
  gasCovered?: boolean
  /** True when the simulation predicted the transaction would revert (reddens the confirm button). */
  isReverted?: boolean
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}
