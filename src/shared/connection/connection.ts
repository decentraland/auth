import { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'

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

    // Identity may be undefined if the user hasn't signed yet or it expired.
    // We still return the connection data so the provider can expose the account,
    // subscribe to wallet events, and let consumers trigger identity generation.
    const identity = localStorageGetIdentity(previousConnection.account) ?? undefined

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
