import { AuthIdentity } from '@dcl/crypto'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'
import { authDebug } from '../utils/authDebug'
import { AuthDebugDecision, AuthDebugEvent, AuthDebugStep } from '../utils/authDebug.type'

export type DefinedConnectionResponse = Omit<ConnectionResponse, 'account'> & { account: string }
export type ConnectionData = DefinedConnectionResponse & { identity: AuthIdentity }

/**
 * Gets the current connection data including the identity.
 * Works transparently with all provider types (MetaMask, Magic, Thirdweb, etc.)
 *
 * @returns The connection data or null if not connected.
 */
export const getCurrentConnectionData = async (): Promise<ConnectionData | null> => {
  authDebug({
    event: AuthDebugEvent.CONNECTION_TRY_PREVIOUS_STARTED,
    step: AuthDebugStep.GET_CURRENT_CONNECTION_DATA
  })

  try {
    const previousConnection = await connection.tryPreviousConnection()
    const providerType = previousConnection.providerType ? String(previousConnection.providerType) : 'n/a'

    if (!previousConnection.account) {
      authDebug({
        event: AuthDebugEvent.CONNECTION_TRY_PREVIOUS_RESULT,
        providerType,
        step: AuthDebugStep.GET_CURRENT_CONNECTION_DATA,
        decision: AuthDebugDecision.NO_ACCOUNT
      })
      return null
    }

    const identity = localStorageGetIdentity(previousConnection.account)
    if (!identity) {
      authDebug({
        event: AuthDebugEvent.CONNECTION_TRY_PREVIOUS_RESULT,
        account: previousConnection.account,
        providerType,
        step: AuthDebugStep.GET_CURRENT_CONNECTION_DATA,
        decision: AuthDebugDecision.IDENTITY_MISSING
      })
      return null
    }

    authDebug({
      event: AuthDebugEvent.CONNECTION_TRY_PREVIOUS_RESULT,
      account: previousConnection.account,
      providerType,
      step: AuthDebugStep.GET_CURRENT_CONNECTION_DATA,
      decision: AuthDebugDecision.CONNECTED
    })

    return {
      ...previousConnection,
      account: previousConnection.account,
      identity
    }
  } catch (error) {
    authDebug({
      event: AuthDebugEvent.CONNECTION_TRY_PREVIOUS_RESULT,
      step: AuthDebugStep.GET_CURRENT_CONNECTION_DATA,
      decision: AuthDebugDecision.ERROR,
      details: {
        message: error instanceof Error ? error.message : String(error)
      }
    })
    return null
  }
}
