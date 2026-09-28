import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas'
import { ConnectionResponse, connection } from 'decentraland-connect'
import { getCurrentConnectionData } from './connection'
import { getCachedIdentity, getIdentitySignature as getIdentitySignatureUtil } from './identity'

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
   * Generates a fresh identity for the connected wallet and refreshes the connection context.
   * An optional signal cancels persistence and completion of an abandoned login attempt.
   *
   * When called without arguments, it internally calls `tryPreviousConnection()`
   * to obtain the provider and account.
   *
   * When a `ConnectionResponse` is passed (e.g. from a preceding `connection.connect()`
   * call), it reuses that response directly, avoiding a redundant reconnection.
   */
  getIdentitySignature: (existingConnection?: ConnectionResponse, options?: { signal?: AbortSignal }) => Promise<AuthIdentity>
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
  // Only the latest connection operation may commit or return an identity. Matching callers
  // share its wallet prompt; a different account or provider starts a new operation.
  const connectionGenerationRef = useRef(0)
  const currentAccountRef = useRef(state.account)
  const currentProviderRef = useRef(state.provider)
  const signingConnectionRef = useRef<ConnectionResponse>()
  const inflightIdentityRef = useRef<{
    key: string
    provider: ConnectionResponse['provider'] | undefined
    generation: number
    promise: Promise<AuthIdentity>
  }>()

  const providerListenersCleanupRef = useRef<() => void>()

  // Install durable listeners before publishing a provider, rather than waiting for a React
  // effect. Signing listeners can then be removed without missing events during that handoff.
  const observeProvider = useCallback((provider: ConnectionResponse['provider'] | undefined) => {
    providerListenersCleanupRef.current?.()
    providerListenersCleanupRef.current = undefined
    if (!provider) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (currentProviderRef.current !== provider) return
      const account = accounts[0]
      const signingConnection = signingConnectionRef.current
      // Keep the visible connection accurate if its replacement fails, without invalidating
      // the replacement provider's independent identity operation.
      const isSigningWithAnotherProvider = signingConnection && signingConnection.provider !== provider
      const expectedAccount = signingConnection?.provider === provider ? signingConnection.account : currentAccountRef.current
      if (!isSigningWithAnotherProvider && (!account || account.toLowerCase() !== expectedAccount?.toLowerCase())) {
        ++connectionGenerationRef.current
      }
      currentAccountRef.current = account
      if (!account) {
        currentProviderRef.current = undefined
        providerListenersCleanupRef.current?.()
        providerListenersCleanupRef.current = undefined
        // Wallet disconnected — clear all connection state so downstream consumers
        // (e.g. RequestPage checking !provider || !providerType) detect the disconnect.
        setState(prev =>
          prev.provider !== provider
            ? prev
            : {
                ...prev,
                account: undefined,
                identity: undefined,
                provider: undefined,
                providerType: undefined,
                chainId: undefined
              }
        )
        return
      }

      const identity = getCachedIdentity(account)
      setState(prev => (prev.provider !== provider ? prev : { ...prev, account, identity }))
    }

    const handleChainChanged = (chainId: string) => {
      if (currentProviderRef.current !== provider) return
      setState(prev => (prev.provider !== provider ? prev : { ...prev, chainId: parseInt(chainId, 16) }))
    }

    if (typeof provider.on !== 'function') return

    const handleDisconnect = () => handleAccountsChanged([])
    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)
    provider.on('disconnect', handleDisconnect)

    providerListenersCleanupRef.current = () => {
      if (typeof provider.removeListener === 'function') {
        provider.removeListener('accountsChanged', handleAccountsChanged)
        provider.removeListener('chainChanged', handleChainChanged)
        provider.removeListener('disconnect', handleDisconnect)
      }
    }
  }, [])

  /**
   * Fetches the current connection data (account, identity, provider, etc.)
   * and updates the context state on mount, unless a login has superseded the restore.
   */
  const fetchConnectionData = useCallback(async () => {
    const generation = connectionGenerationRef.current
    const connectionData = await getCurrentConnectionData()
    if (generation !== connectionGenerationRef.current) return
    currentAccountRef.current = connectionData?.account
    currentProviderRef.current = connectionData?.provider
    observeProvider(connectionData?.provider)
    setState({
      isLoading: false,
      account: connectionData?.account,
      identity: connectionData?.identity,
      provider: connectionData?.provider,
      providerType: connectionData?.providerType,
      chainId: connectionData?.chainId
    })
  }, [observeProvider])

  const getIdentitySignature = useCallback(
    async (existingConnection?: ConnectionResponse, options?: { signal?: AbortSignal }): Promise<AuthIdentity> => {
      const signal = options?.signal
      signal?.throwIfAborted()
      // Key the in-flight dedup by account. When no existing connection is provided we
      // fall back to a shared key, since that path always resolves to the single
      // "previous" connection (preserving "create identity once per login").
      const inflightKey = existingConnection?.account?.toLowerCase() ?? '__previous__'

      // If an identity generation for this account is already in progress, return the
      // same promise to avoid prompting the user for a duplicate wallet signature.
      const inflight = inflightIdentityRef.current
      if (
        inflight?.key === inflightKey &&
        inflight.provider === existingConnection?.provider &&
        inflight.generation === connectionGenerationRef.current
      ) {
        const identity = await inflight.promise
        signal?.throwIfAborted()
        if (inflight.generation !== connectionGenerationRef.current) throw new Error('Connection changed while creating identity')
        return identity
      }

      const generation = ++connectionGenerationRef.current
      signingConnectionRef.current = existingConnection
      // Login now owns connection restoration, including failure. Do not leave consumers waiting
      // for an initial restore whose result this operation has superseded.
      setState(previous => ({ ...previous, isLoading: false }))
      const assertCurrentConnection = () => {
        signal?.throwIfAborted()
        if (generation !== connectionGenerationRef.current) throw new Error('Connection changed while creating identity')
      }
      const invalidateCancelledOperation = () => {
        if (generation === connectionGenerationRef.current) ++connectionGenerationRef.current
      }
      signal?.addEventListener('abort', invalidateCancelledOperation, { once: true })
      const promise = (async () => {
        const connectionResponse = existingConnection ?? (await connection.tryPreviousConnection())
        assertCurrentConnection()

        if (!connectionResponse.account || !connectionResponse.provider || !connectionResponse.providerType) {
          throw new Error('No active connection found')
        }

        // A newly connected provider is not in context yet. Observe it during the wallet prompt,
        // so an account change or disconnect cannot install the identity of the abandoned login.
        signingConnectionRef.current = connectionResponse
        const provider = connectionResponse.provider
        let chainId = connectionResponse.chainId
        const invalidate = () => {
          if (generation === connectionGenerationRef.current) ++connectionGenerationRef.current
        }
        const handleAccountsChanged = (accounts: string[]) => {
          if (accounts[0]?.toLowerCase() !== connectionResponse.account?.toLowerCase()) invalidate()
        }
        const handleChainChanged = (value: string) => {
          chainId = parseInt(value, 16)
        }
        if (typeof provider.on === 'function') {
          provider.on('accountsChanged', handleAccountsChanged)
          provider.on('disconnect', invalidate)
          provider.on('chainChanged', handleChainChanged)
        }

        try {
          const identity = await getIdentitySignatureUtil(connectionResponse.account, provider, undefined, assertCurrentConnection)
          assertCurrentConnection()
          currentAccountRef.current = connectionResponse.account
          currentProviderRef.current = provider
          observeProvider(provider)
          setState({
            isLoading: false,
            account: connectionResponse.account,
            identity,
            provider,
            providerType: connectionResponse.providerType,
            chainId
          })
          return identity
        } finally {
          if (typeof provider.removeListener === 'function') {
            provider.removeListener('accountsChanged', handleAccountsChanged)
            provider.removeListener('disconnect', invalidate)
            provider.removeListener('chainChanged', handleChainChanged)
          }
        }
      })()

      inflightIdentityRef.current = { key: inflightKey, provider: existingConnection?.provider, generation, promise }

      try {
        const identity = await promise
        assertCurrentConnection()
        return identity
      } finally {
        signal?.removeEventListener('abort', invalidateCancelledOperation)
        if (inflightIdentityRef.current?.promise === promise) {
          inflightIdentityRef.current = undefined
          signingConnectionRef.current = undefined
        }
      }
    },
    [observeProvider]
  )

  useEffect(() => {
    fetchConnectionData()
    return () => {
      ++connectionGenerationRef.current
      inflightIdentityRef.current = undefined
      currentProviderRef.current = undefined
      currentAccountRef.current = undefined
      observeProvider(undefined)
    }
  }, [fetchConnectionData, observeProvider])

  const value = useMemo<ConnectionContextValue>(() => ({ ...state, getIdentitySignature }), [state, getIdentitySignature])

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

const useCurrentConnectionData = () => useContext(ConnectionContext)

export { useCurrentConnectionData, ConnectionProvider }
