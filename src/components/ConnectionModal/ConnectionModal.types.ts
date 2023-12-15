export enum ConnectionModalState {
  CONNECTING_WALLET = 'CONNECTING_WALLET',
  WAITING_FOR_SIGNATURE = 'WAITING_FOR_SIGNATURE',
  ERROR = 'ERROR',
  LOADING_MAGIC = 'LOADING_MAGIC'
}

export type ConnectionModalProps = {
  open: boolean
  state: ConnectionModalState
  onClose: () => unknown
  onTryAgain: () => unknown
}
