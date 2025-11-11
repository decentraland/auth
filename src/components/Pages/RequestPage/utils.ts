import { ethers } from 'ethers'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection, Provider } from 'decentraland-connect'
import { config } from '../../../modules/config'

export async function getConnectedProvider(): Promise<Provider | null> {
  try {
    return await connection.getProvider()
  } catch (_e) {
    try {
      const { provider } = await connection.tryPreviousConnection()
      return provider
    } catch (error) {
      return null
    }
  }
}

export async function getNetworkProvider(chainId: ChainId): Promise<Provider> {
  /*
          We check if the connected provider is from the same chainId, if so we return that one instead of creating one.
          This is to avoid using our own RPCs that much, and use the ones provided by the provider when possible.
        */
  const connectedProvider = await getConnectedProvider()
  if (connectedProvider) {
    const connectedChainId = Number((await new ethers.BrowserProvider(connectedProvider).getNetwork()).chainId)
    if (Number(chainId) === connectedChainId) {
      return connectedProvider
    }
  }
  return connection.createProvider(ProviderType.NETWORK, chainId)
}

export async function getProviderChainId(provider: Provider): Promise<number> {
  const providerChainId = (await provider.request({
    method: 'eth_chainId',
    params: []
  })) as string | number

  let chainId: number

  if (typeof providerChainId === 'string') {
    chainId = parseInt(providerChainId, 16)
  } else {
    chainId = providerChainId
  }

  return chainId
}

/**
 * Validates if an address corresponds to a Decentraland contract address (including collections).
 * @param address The Ethereum address to validate
 * @returns true if the address is a valid Decentraland contract address, false otherwise
 */
export async function isDecentralandContractAddress(address: string): Promise<boolean> {
  try {
    const transactionApiUrl = config.get('META_TRANSACTION_SERVER_URL')
    const response = await fetch(`${transactionApiUrl}/contracts/${address}`)

    if (response.status === 200) {
      const data = await response.json()
      return data.ok === true
    }

    return false
  } catch (error) {
    console.error('Error validating Decentraland contract address:', error)
    return false
  }
}
