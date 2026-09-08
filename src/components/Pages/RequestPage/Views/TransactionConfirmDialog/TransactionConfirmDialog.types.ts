export interface TransactionConfirmDialogProps {
  open: boolean
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}
