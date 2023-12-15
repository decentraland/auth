import { ConnectionModalState } from './ConnectionModal.types'

export function getConnectionMessage(connectionState: ConnectionModalState) {
  switch (connectionState) {
    case ConnectionModalState.ERROR: {
      return 'You rejected the request in your <b>Wallet</b>. To continue, please try again.'
    }
    case ConnectionModalState.CONNECTING_WALLET: {
      return 'To move forward, confirm the connect action in your <b>Wallet</b>.'
    }
    case ConnectionModalState.WAITING_FOR_SIGNATURE: {
      return 'To move forward, confirm the signature action in your <b>Wallet</b>.'
    }
    case ConnectionModalState.LOADING_MAGIC: {
      return 'Redirecting...'
    }
  }
}
