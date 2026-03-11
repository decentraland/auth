import { PropsWithChildren, createContext, useContext, useEffect, useState } from 'react'
import { AuthIdentity } from '@dcl/crypto'
import { ProviderType } from '@dcl/schemas'
import { ConnectionResponse } from 'decentraland-connect'
import { getCurrentConnectionData } from './connection'

type ConnectionContextValue = {
  isLoading: boolean
  account: string | undefined
  identity: AuthIdentity | undefined
  provider: ConnectionResponse['provider'] | undefined
  providerType: ProviderType | undefined
  chainId: number | undefined
}

const defaultValue: ConnectionContextValue = {
  isLoading: true,
  account: undefined,
  identity: undefined,
  provider: undefined,
  providerType: undefined,
  chainId: undefined
}
// eslint-disable-next-line @typescript-eslint/naming-convention
const ConnectionContext = createContext<ConnectionContextValue>(defaultValue)

const ConnectionProvider = ({ children }: PropsWithChildren) => {
  const [value, setValue] = useState<ConnectionContextValue>(defaultValue)

  useEffect(() => {
    let cancelled = false

    const fetchConnectionData = async () => {
      const connectionData = await getCurrentConnectionData()
      if (cancelled) return
      setValue({
        isLoading: false,
        account: connectionData?.account,
        identity: connectionData?.identity,
        provider: connectionData?.provider,
        providerType: connectionData?.providerType,
        chainId: connectionData?.chainId
      })
    }

    fetchConnectionData()

    return () => {
      cancelled = true
    }
  }, [])

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

const useCurrentConnectionData = () => useContext(ConnectionContext)

export { useCurrentConnectionData, ConnectionProvider }
