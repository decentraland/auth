export type TransferActionButtonsProps = {
  cancelText?: string
  confirmText?: string
  isLoading: boolean
  /** Holds the confirm button, for a view that asks for an acknowledgment first. */
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}
