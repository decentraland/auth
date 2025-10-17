import { ProviderType } from '@dcl/schemas'

enum LoadingLayoutState {
  CONNECTING_WALLET = 'CONNECTING_WALLET',
  WAITING_FOR_SIGNATURE = 'WAITING_FOR_SIGNATURE',
  ERROR = 'ERROR',
  LOADING_MAGIC = 'LOADING_MAGIC',
  VALIDATING_SIGN_IN = 'VALIDATING_SIGN_IN',
  WAITING_FOR_CONFIRMATION = 'WAITING_FOR_CONFIRMATION',
  ERROR_LOCKED_WALLET = 'ERROR_LOCKED_WALLET'
}

type LoadingLayoutProps = {
  onTryAgain: () => void
  state: LoadingLayoutState
  providerType: ProviderType | null
}

export { LoadingLayoutState }
export type { LoadingLayoutProps }
