import { ethers } from 'ethers'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection, Provider } from 'decentraland-connect'
import { ContractName, getContractName } from 'decentraland-transactions'
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

/**
 * Gets the appropriate chain ID based on the environment.
 * @returns ChainId.MATIC_MAINNET for production/staging, ChainId.MATIC_AMOY otherwise
 */
export function getMetaTransactionChainId(): ChainId {
  return ['production', 'staging'].includes(config.get('ENVIRONMENT').toLowerCase()) ? ChainId.MATIC_MAINNET : ChainId.MATIC_AMOY
}

/**
 * Checks if a contract will use meta transactions and returns the contract name.
 * @param contractAddress The contract address to check
 * @returns Object with willUseMetaTransaction boolean and contractName (or null)
 */
export async function checkMetaTransactionSupport(
  contractAddress: string
): Promise<{ willUseMetaTransaction: boolean; contractName: ContractName | null }> {
  try {
    const contractName = getContractName(contractAddress)
    return { willUseMetaTransaction: true, contractName }
  } catch (error) {
    const isAcceptedAddress = await isDecentralandContractAddress(contractAddress.toLowerCase())
    if (isAcceptedAddress) {
      return { willUseMetaTransaction: true, contractName: ContractName.ERC721CollectionV2 }
    }
    return { willUseMetaTransaction: false, contractName: null }
  }
}

/**
 * Decodes NFT transfer data to extract token ID and destination address
 * @param data The transaction data
 * @param contractABI The contract ABI to use for decoding
 * @returns Object containing tokenId and toAddress, or null if decoding fails
 */
export function decodeNftTransferData(data: string, contractABI: object[]): { tokenId: string; toAddress: string } | null {
  try {
    if (!data || data.length < 10) return null

    const contractInterface = new ethers.Interface(contractABI)

    // Decode the transaction data using the ABI
    const decodedData = contractInterface.parseTransaction({ data })

    if (!decodedData) {
      console.error('Failed to decode transaction data')
      return null
    }

    // All ERC721 transfer methods have these parameters:
    // transferFrom(address from, address to, uint256 tokenId)
    // safeTransferFrom(address from, address to, uint256 tokenId)
    // safeTransferFrom(address from, address to, uint256 tokenId, bytes data)
    const toAddress = decodedData.args[1] as string // 'to' address is always the second parameter
    const tokenId = decodedData.args[2].toString() // tokenId is always the third parameter

    return { tokenId, toAddress }
  } catch (error) {
    console.error('Error decoding NFT transfer data:', error)
    return null
  }
}

/**
 * Fetches NFT metadata from tokenURI
 * @param contractAddress The NFT contract address
 * @param contractABI The contract ABI to use for interacting with the contract
 * @param tokenId The token ID
 * @param provider The ethers provider
 * @returns Object containing image URL and other metadata
 */
export async function fetchNftMetadata(
  contractAddress: string,
  contractABI: object[],
  tokenId: string,
  provider: ethers.BrowserProvider
): Promise<{ imageUrl: string; name?: string; description?: string } | null> {
  try {
    // Use the provided contract ABI to interact with the NFT contract
    const contract = new ethers.Contract(contractAddress, contractABI, provider)
    const tokenUri = await contract.tokenURI(tokenId)

    if (!tokenUri) {
      console.error('No tokenURI returned')
      return null
    }

    // Handle IPFS URIs
    const metadataUrl = tokenUri

    // Fetch the metadata JSON
    const metadataResponse = await fetch(metadataUrl)
    if (!metadataResponse.ok) {
      console.error('Failed to fetch metadata:', metadataResponse.statusText)
      return null
    }

    const metadata = await metadataResponse.json()

    const imageUrl = metadata.image || metadata.image_url

    return {
      imageUrl,
      name: metadata.name,
      description: metadata.description
    }
  } catch (error) {
    console.error('Error fetching NFT metadata:', error)
    return null
  }
}
