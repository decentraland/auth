import { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'

export type DefinedConnectionResponse = Omit<ConnectionResponse, 'account'> & { account: string }
export type ConnectionData = DefinedConnectionResponse & { identity: AuthIdentity }

/**
 * Gets the current connection data including the identity.
 * Works transparently with all provider types (MetaMask, Magic, Thirdweb, etc.)
 *
 * @returns The connection data or null if not connected.
 */
export const getCurrentConnectionData = async (): Promise<ConnectionData | null> => {
  try {
    const previousConnection = await connection.tryPreviousConnection()

    if (!previousConnection.account) {
      return null
    }

    const identity = localStorageGetIdentity(previousConnection.account)
    if (!identity) {
      return null
    }

    return {
      ...previousConnection,
      account: previousConnection.account,
      identity
    }
  } catch (error) {
    return null
  }
}
