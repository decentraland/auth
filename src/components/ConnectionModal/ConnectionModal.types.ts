import { ProviderType } from '@dcl/schemas'
import { ConnectionLayoutState } from './ConnectionLayout.type'

export type ConnectionModalProps = {
  open: boolean
  state: ConnectionLayoutState
  providerType: ProviderType | null
  onClose?: () => unknown
  onTryAgain: () => unknown
}
