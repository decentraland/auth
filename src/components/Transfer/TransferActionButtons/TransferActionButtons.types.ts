export type TransferActionButtonsProps = {
  cancelText?: string
  confirmText?: string
  isLoading: boolean
  /** Blocks Confirm for a reason of the caller's own, while Cancel stays available. */
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}
