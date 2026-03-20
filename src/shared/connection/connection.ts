import { AuthIdentity } from '@dcl/crypto'
import { ConnectionResponse, connection } from 'decentraland-connect'
import { getCachedIdentity } from './identity'

type DefinedConnectionResponse = Omit<ConnectionResponse, 'account'> & { account: string }
type ConnectionData = DefinedConnectionResponse & { identity: AuthIdentity | undefined }

/**
 * Gets the current connection data including the identity if available.
 * Works transparently with all provider types (MetaMask, Magic, Thirdweb, etc.)
 *
 * @returns The connection data or null if not connected.
 */
const getCurrentConnectionData = async (): Promise<ConnectionData | null> => {
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
