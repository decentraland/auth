export type TransferActionButtonsProps = {
  cancelText?: string
  confirmText?: string
  isLoading: boolean
  /** Disables only the confirm button (e.g. pending a required acknowledgment). */
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}
