import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas'
import { localStorageGetIdentity } from '@dcl/single-sign-on-client'
import { ConnectionResponse, connection } from 'decentraland-connect'
import { getCurrentConnectionData } from './connection'
import { getIdentitySignature as getIdentitySignatureUtil } from './identity'

type ConnectionState = {
  isLoading: boolean
  account: string | undefined
  identity: AuthIdentity | undefined
  provider: ConnectionResponse['provider'] | undefined
  providerType: ProviderType | undefined
  chainId: number | undefined
}

type ConnectionContextValue = ConnectionState & {
  /**
   * Generates (or retrieves from localStorage) an identity for the currently
   * connected wallet, then automatically refreshes the connection context.
   *
   * When called without arguments, it internally calls `tryPreviousConnection()`
   * to obtain the provider and account.
   *
   * When a `ConnectionResponse` is passed (e.g. from a preceding `connection.connect()`
   * call), it reuses that response directly, avoiding a redundant reconnection.
   */
  getIdentitySignature: (existingConnection?: ConnectionResponse) => Promise<AuthIdentity>
}

const defaultState: ConnectionState = {
  isLoading: true,
  account: undefined,
  identity: undefined,
  provider: undefined,
  providerType: undefined,
  chainId: undefined
}

const defaultValue: ConnectionContextValue = {
  ...defaultState,
  getIdentitySignature: () => Promise.reject(new Error('ConnectionProvider not mounted'))
}
// eslint-disable-next-line @typescript-eslint/naming-convention
const ConnectionContext = createContext<ConnectionContextValue>(defaultValue)

const ConnectionProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<ConnectionState>(defaultState)
  // Tracks an in-flight identity generation promise so that concurrent callers
  // share a single wallet signature prompt instead of triggering duplicates.
  const inflightIdentityRef = useRef<Promise<AuthIdentity> | null>(null)

  /**
   * Fetches the current connection data (account, identity, provider, etc.)
   * and updates the context state. Used on mount and when the provider emits
   * wallet change events (accountsChanged, chainChanged).
   */
  const fetchConnectionData = useCallback(async () => {
    const connectionData = await getCurrentConnectionData()
    setState({
      isLoading: false,
      account: connectionData?.account,
      identity: connectionData?.identity,
      provider: connectionData?.provider,
      providerType: connectionData?.providerType,
      chainId: connectionData?.chainId
    })
  }, [])

  const getIdentitySignature = useCallback(async (existingConnection?: ConnectionResponse): Promise<AuthIdentity> => {
    // If an identity generation is already in progress, return the same promise
    // to avoid prompting the user for a duplicate wallet signature.
    if (inflightIdentityRef.current) {
      return inflightIdentityRef.current
    }

    const promise = (async () => {
      const connectionResponse = existingConnection ?? (await connection.tryPreviousConnection())

      // Validate that all required fields are present, including providerType,
      // to prevent downstream consumers from seeing an incomplete connection state.
      if (!connectionResponse.account || !connectionResponse.provider || !connectionResponse.providerType) {
        throw new Error('No active connection found')
      }

      const identity = await getIdentitySignatureUtil(connectionResponse.account, connectionResponse.provider)

      setState({
        isLoading: false,
        account: connectionResponse.account,
        identity,
        provider: connectionResponse.provider,
        providerType: connectionResponse.providerType,
        chainId: connectionResponse.chainId
      })

      return identity
    })()

    inflightIdentityRef.current = promise

    try {
      return await promise
    } finally {
      inflightIdentityRef.current = null
    }
  }, [])

  useEffect(() => {
    fetchConnectionData()
  }, [fetchConnectionData])

  // Listen for wallet changes (account or chain switches) on the provider
  useEffect(() => {
    const provider = state.provider
    if (!provider) return

    const handleAccountsChanged = (accounts: string[]) => {
      const account = accounts[0]
      if (!account) {
        setState(prev => ({ ...prev, account: undefined, identity: undefined }))
        return
      }

      const identity = localStorageGetIdentity(account) ?? undefined
      setState(prev => ({ ...prev, account, identity }))
    }

    const handleChainChanged = (chainId: string) => {
      setState(prev => ({ ...prev, chainId: parseInt(chainId, 16) }))
    }

    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)

    return () => {
      provider.off('accountsChanged', handleAccountsChanged)
      provider.off('chainChanged', handleChainChanged)
    }
  }, [state.provider])

  const value = useMemo<ConnectionContextValue>(() => ({ ...state, getIdentitySignature }), [state, getIdentitySignature])

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

const useCurrentConnectionData = () => useContext(ConnectionContext)

export { useCurrentConnectionData, ConnectionProvider }
