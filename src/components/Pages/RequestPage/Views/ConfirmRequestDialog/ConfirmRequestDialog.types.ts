/** What the request will cost the user, as the dialog states it. */
type ConfirmRequestGas =
  | { covered: true }
  | { covered: false; status: 'loading' }
  | { covered: false; status: 'unavailable' }
  | { covered: false; status: 'ready'; cost: bigint; chainId: number }

interface ConfirmRequestDialogProps {
  open: boolean
  /** Whether the wallet is about to send a transaction or produce a signature. */
  kind: 'transaction' | 'signature'
  /** Transactions only: covered by the relay, or the wallet's own fee estimate. */
  gas?: ConfirmRequestGas
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export type { ConfirmRequestDialogProps, ConfirmRequestGas }
