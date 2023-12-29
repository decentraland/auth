import { ProviderType } from '@dcl/schemas'

export enum ConnectionModalState {
  CONNECTING_WALLET = 'CONNECTING_WALLET',
  WAITING_FOR_SIGNATURE = 'WAITING_FOR_SIGNATURE',
  ERROR = 'ERROR',
  LOADING_MAGIC = 'LOADING_MAGIC',
  VALIDATING_SIGN_IN = 'VALIDATING_SIGN_IN'
}

export type ConnectionModalProps = {
  open: boolean
  state: ConnectionModalState
  providerType: ProviderType | null
  onClose?: () => unknown
  onTryAgain: () => unknown
}
