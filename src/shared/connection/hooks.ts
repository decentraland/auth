import { useEffect, useState } from 'react'
import { ConnectionData, getCurrentConnectionData } from './connection'

export const useCurrentConnectionData = () => {
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchConnectionData = async () => {
      const connectionData = await getCurrentConnectionData()
      if (cancelled) return
      setConnectionData(connectionData)
      setIsLoading(false)
    }

    fetchConnectionData()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    isLoading,
    account: connectionData?.account,
    identity: connectionData?.identity,
    provider: connectionData?.provider,
    providerType: connectionData?.providerType,
    chainId: connectionData?.chainId
  }
}
