import { useEffect, useState, useCallback } from 'react'
import { ConnectionData, getCurrentConnectionData } from './connection'

export const useCurrentConnectionData = () => {
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshConnectionData = useCallback(async () => {
    const data = await getCurrentConnectionData()
    setConnectionData(data)
    setIsLoading(false)
  }, [])

  // Fetch connection data on mount
  useEffect(() => {
    let cancelled = false

    const fetchConnectionData = async () => {
      const data = await getCurrentConnectionData()
      if (cancelled) return
      setConnectionData(data)
      setIsLoading(false)
    }

    fetchConnectionData()

    return () => {
      cancelled = true
    }
  }, [])

  // Listen for account changes from the provider
  useEffect(() => {
    const provider = connectionData?.provider
    if (!provider) return

    const onAccountsChanged = () => {
      refreshConnectionData()
    }

    if (typeof provider.on === 'function') {
      provider.on('accountsChanged', onAccountsChanged)
    } else if (typeof provider.addListener === 'function') {
      provider.addListener('accountsChanged', onAccountsChanged)
    }

    return () => {
      if (typeof provider.off === 'function') {
        provider.off('accountsChanged', onAccountsChanged)
      } else if (typeof provider.removeListener === 'function') {
        provider.removeListener('accountsChanged', onAccountsChanged)
      }
    }
  }, [connectionData?.provider, refreshConnectionData])

  return {
    isLoading,
    account: connectionData?.account,
    identity: connectionData?.identity,
    provider: connectionData?.provider,
    providerType: connectionData?.providerType,
    chainId: connectionData?.chainId
  }
}
