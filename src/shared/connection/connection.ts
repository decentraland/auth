import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas'
import { ConnectionResponse, connection, getConfiguration } from 'decentraland-connect'
import { getCachedIdentity } from './identity'
import { hasStoredWalletConnectSession } from './walletConnect'

type DefinedConnectionResponse = Omit<ConnectionResponse, 'account'> & { account: string }
type ConnectionData = DefinedConnectionResponse & { identity: AuthIdentity | undefined }

/**
 * The provider the last connection was made with, read straight from storage.
 *
 * Asking `decentraland-connect` would mean going through `tryPreviousConnection()`, which is the
 * call this is here to decide about.
 */
function getStoredProviderType(): ProviderType | undefined {
  try {
    const stored = localStorage.getItem(getConfiguration().storageKey)
    return stored ? (JSON.parse(stored)?.providerType as ProviderType | undefined) : undefined
  } catch {
    return undefined
  }
}

/**
 * Gets the current connection data including the identity if available.
 * Works transparently with all provider types (MetaMask, Magic, Thirdweb, etc.)
 *
 * @returns The connection data or null if not connected.
 */
const getCurrentConnectionData = async (): Promise<ConnectionData | null> => {
  // Restoring WalletConnect is only passive while a session exists. Without one the connector
  // opens the wallet chooser and arms a five-minute timer that nothing is waiting on, and when it
  // expires it rejects with `Connection timeout` on top of whatever the user is doing by then —
  // usually the login they just started. Nothing can be restored here anyway, so skip it.
  if (getStoredProviderType() === ProviderType.WALLET_CONNECT_V2 && !hasStoredWalletConnectSession()) {
    return null
  }

  try {
    const previousConnection = await connection.tryPreviousConnection()

    if (!previousConnection.account) {
      return null
    }

    // Identity may be undefined if the user hasn't signed yet, it expired,
    // or the cached identity is structurally invalid.
    // We still return the connection data so the provider can expose the account,
    // subscribe to wallet events, and let consumers trigger identity generation.
    const identity = getCachedIdentity(previousConnection.account)

    return {
      ...previousConnection,
      account: previousConnection.account,
      identity
    }
  } catch {
    return null
  }
}

export type { DefinedConnectionResponse, ConnectionData }
export { getCurrentConnectionData }
