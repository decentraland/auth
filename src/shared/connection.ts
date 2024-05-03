import { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'

export type DefinedConnectionResponse = Omit<ConnectionResponse, 'account'> & { account: string }
export type ConnectionData = DefinedConnectionResponse & { identity: AuthIdentity }

/**
 * Gets the current connection data.
 * @returns {Promise<ConnectionData | null>} The connection data or null if the user isn't connected or has no identity.
 */
export const getCurrentConnectionData = async (): Promise<ConnectionData | null> => {
  try {
    const previousConnection = await connection.tryPreviousConnection()
    if (previousConnection.account && previousConnection.provider) {
      const identity = localStorageGetIdentity(previousConnection.account)
      if (identity) {
        return { ...(previousConnection as DefinedConnectionResponse), identity }
      }
    }
    return null
  } catch (error) {
    return null
  }
}
