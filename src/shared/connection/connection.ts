import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'
import { resetWalletConnectConnection } from './walletConnect'

export type DefinedConnectionResponse = Omit<ConnectionResponse, 'account'> & { account: string }
export type ConnectionData = DefinedConnectionResponse & { identity: AuthIdentity }

type StoredConnectionData = {
  providerType?: ProviderType
  chainId?: number
}

// This key is defined by decentraland-connect's default configuration and stores `{ providerType, chainId }`.
const DCL_CONNECT_STORAGE_KEY = 'decentraland-connect-storage-key'

function getStoredConnectionData(): StoredConnectionData | null {
  if (typeof window === 'undefined') return null
  if (typeof localStorage === 'undefined') return null

  const raw = localStorage.getItem(DCL_CONNECT_STORAGE_KEY)
  if (!raw) return null

  try {
    // We keep this parse defensive: if the stored value is corrupted we fall back to "no stored connection".
    return JSON.parse(raw) as StoredConnectionData
  } catch (_error) {
    return null
  }
}

/**
 * Gets the current connection data.
 * @returns {Promise<ConnectionData | null>} The connection data or null if the user isn't connected or has no identity.
 */
export const getCurrentConnectionData = async (): Promise<ConnectionData | null> => {
  try {
    const stored = getStoredConnectionData()
    const isWalletConnectV2 = stored?.providerType === ProviderType.WALLET_CONNECT_V2

    // Avoid cold-start auto-activation for WalletConnect.
    // In a fresh page load, `tryPreviousConnection()` calls `connect()` under the hood, which initializes WC Core
    // and can leave stale state behind. For auth flows we prefer an explicit user action.
    if (isWalletConnectV2 && !connection.isConnected()) {
      await resetWalletConnectConnection()
      return null
    }

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
