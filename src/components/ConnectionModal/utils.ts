import { ProviderType } from '@dcl/schemas'
import { ConnectionModalState } from './ConnectionModal.types'

export function getConnectionMessage(connectionState: ConnectionModalState, providerType: ProviderType | null) {
  switch (connectionState) {
    case ConnectionModalState.ERROR: {
      return 'You did not confirm this action in your digital wallet extension. To continue, please try again.'
    }
    case ConnectionModalState.CONNECTING_WALLET:
    case ConnectionModalState.WAITING_FOR_SIGNATURE: {
      return providerType === ProviderType.MAGIC
        ? 'Almost done! Confirm your request to login Decentraland'
        : 'Confirm in your digital wallet extension to continue.'
    }
    case ConnectionModalState.VALIDATING_SIGN_IN: {
      return "Just a moment, we're verifying your login credentials..."
    }
    case ConnectionModalState.LOADING_MAGIC: {
      return 'Redirecting...'
    }
  }
}
