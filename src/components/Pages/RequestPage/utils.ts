import { ethers } from 'ethers'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { Provider, connection } from 'decentraland-connect'
import { ContractName, getContract, getContractName } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import { isMobile } from '../LoginPage/utils'

const DEEPLINK_DETECTION_TIMEOUT = 500

/**
 * Attempts to launch a deep link and detects if the app handled it.
 * Uses blur detection technique - if window loses focus, app was launched.
 * Returns true if app was detected, false otherwise.
 */
const launchDeepLink = (url: string): Promise<boolean> => {
  return new Promise(resolve => {
    if (isMobile()) {
      window.location.href = url
      resolve(true)
      return
    }

    let appDetected = false

    const handleBlur = () => {
      appDetected = true
    }

    window.addEventListener('blur', handleBlur)

    // Create a hidden iframe to trigger the deep link
    // This avoids Safari redirecting to an invalid URL if app is not installed
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'display: none')
    iframe.src = url
    document.body.appendChild(iframe)

    setTimeout(() => {
      window.removeEventListener('blur', handleBlur)
      document.body.removeChild(iframe)
      resolve(appDetected)
    }, DEEPLINK_DETECTION_TIMEOUT)
  })
}

async function getConnectedProvider(): Promise<Provider | null> {
  try {
    return await connection.getProvider()
  } catch {
    try {
      const { provider } = await connection.tryPreviousConnection()
      return provider
    } catch {
      return null
    }
  }
}

async function getNetworkProvider(chainId: ChainId): Promise<Provider> {
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
async function isDecentralandContractAddress(address: string): Promise<boolean> {
  try {
    const transactionApiUrl = `${config.get('META_TRANSACTION_SERVER_URL')}/v1`
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
function getMetaTransactionChainId(): ChainId {
  return ['production', 'staging'].includes(config.get('ENVIRONMENT').toLowerCase()) ? ChainId.MATIC_MAINNET : ChainId.MATIC_AMOY
}

/**
 * Checks if a contract will use meta transactions and returns the contract name.
 * @param contractAddress The contract address to check
 * @returns Object with willUseMetaTransaction boolean and contractName (or null)
 */
async function checkMetaTransactionSupport(
  contractAddress: string
): Promise<{ willUseMetaTransaction: boolean; contractName: ContractName | null }> {
  try {
    const contractName = getContractName(contractAddress)
    return { willUseMetaTransaction: true, contractName }
  } catch {
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
function decodeNftTransferData(data: string, contractABI: object[]): { tokenId: string; toAddress: string } | null {
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
 * Decodes MANA (ERC20) transfer data to extract amount and destination address
 * @param data The transaction data
 * @returns Object containing manaAmount and toAddress, or null if decoding fails
 */
function decodeManaTransferData(data: string): { manaAmount: string; toAddress: string } | null {
  try {
    if (!data || data.length < 10) return null

    // ERC20 transfer function signature: transfer(address to, uint256 amount)
    const transferFunctionSignature = '0xa9059cbb'

    // Check if this is a transfer function call
    if (!data.startsWith(transferFunctionSignature)) {
      return null
    }

    const contract = getContract(ContractName.ERC20, getMetaTransactionChainId())

    const contractInterface = new ethers.Interface(contract.abi)
    const decodedData = contractInterface.parseTransaction({ data })

    if (!decodedData) {
      console.error('Failed to decode MANA transfer data')
      return null
    }

    const toAddress = decodedData.args[0] as string
    const amount = decodedData.args[1] as bigint

    // Convert from wei to MANA (18 decimals)
    const manaAmount = ethers.formatEther(amount)

    return { manaAmount, toAddress }
  } catch (error) {
    console.error('Error decoding MANA transfer data:', error)
    return null
  }
}

/**
 * Fetches NFT metadata from tokenURI
 * @param contractAddress The NFT contract address
 * @param contractABI The contract ABI to use for interacting with the contract
 * @param tokenId The token ID
 * @returns Object containing image URL and other metadata
 * @throws Error if tokenURI is not found or metadata cannot be fetched
 */
async function fetchNftMetadata(
  contractAddress: string,
  contractABI: object[],
  tokenId: string
): Promise<{ imageUrl: string; name: string; description: string; rarity: Rarity }> {
  // Get the correct network provider for NFT collections (Polygon/Amoy)
  // This is necessary because the user's browser provider may be connected to a different network
  const chainId = getMetaTransactionChainId()
  const networkProvider = await getNetworkProvider(chainId)
  const provider = new ethers.BrowserProvider(networkProvider)

  // Use the provided contract ABI to interact with the NFT contract
  const contract = new ethers.Contract(contractAddress, contractABI, provider)
  const tokenUri = await contract.tokenURI(tokenId)

  if (!tokenUri) {
    throw new Error(`No tokenURI returned for token ${tokenId} at contract ${contractAddress}`)
  }

  // Handle IPFS URIs
  const metadataUrl = tokenUri

  // Fetch the metadata JSON
  const metadataResponse = await fetch(metadataUrl)
  if (!metadataResponse.ok) {
    throw new Error(`Failed to fetch metadata from ${metadataUrl}: ${metadataResponse.status} ${metadataResponse.statusText}`)
  }

  const metadata = await metadataResponse.json()

  const imageUrl = metadata.image || metadata.image_url

  // Extract rarity from attributes
  let rarity: Rarity = Rarity.COMMON
  if (metadata.attributes && Array.isArray(metadata.attributes)) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const rarityAttribute = metadata.attributes.find((attr: { trait_type: string; value: string }) => attr.trait_type === 'Rarity')
    if (rarityAttribute && rarityAttribute.value) {
      // Map the string value to the Rarity enum
      const rarityValue = rarityAttribute.value.toLowerCase()
      switch (rarityValue) {
        case 'unique':
          rarity = Rarity.UNIQUE
          break
        case 'mythic':
          rarity = Rarity.MYTHIC
          break
        case 'exotic':
          rarity = Rarity.EXOTIC
          break
        case 'legendary':
          rarity = Rarity.LEGENDARY
          break
        case 'epic':
          rarity = Rarity.EPIC
          break
        case 'rare':
          rarity = Rarity.RARE
          break
        case 'uncommon':
          rarity = Rarity.UNCOMMON
          break
        case 'common':
          rarity = Rarity.COMMON
          break
        default:
          rarity = Rarity.COMMON
      }
    }
  }

  return {
    imageUrl,
    name: metadata.name,
    description: metadata.description,
    rarity
  }
}

/**
 * Fetches place information by creator address from the Places API
 * @param creatorAddress The creator's Ethereum address
 * @returns Object containing place name and image URL if exactly one place is found, null otherwise
 */
async function fetchPlaceByCreatorAddress(creatorAddress: string): Promise<{ sceneName: string; sceneImageUrl: string } | null> {
  try {
    const placesApiUrl = config.get('PLACES_API_URL')
    const response = await fetch(`${placesApiUrl}/api/places?creator_address=${creatorAddress.toLowerCase()}`)

    if (!response.ok) {
      console.error(`Failed to fetch place info from Places API: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    if (!data.ok || !data.data || data.data.length === 0) {
      console.log(`No places found for creator address: ${creatorAddress}`)
      return null
    }

    // Only return place data if exactly one place is found
    if (data.data.length !== 1) {
      console.log(`Multiple places found for creator address: ${creatorAddress}, showing default view`)
      return null
    }

    const place = data.data[0]

    return {
      sceneName: place.title || 'Unknown Place',
      sceneImageUrl: place.image || ''
    }
  } catch (error) {
    console.error('Error fetching place by creator address:', error)
    return null
  }
}

export {
  launchDeepLink,
  getConnectedProvider,
  getNetworkProvider,
  isDecentralandContractAddress,
  getMetaTransactionChainId,
  checkMetaTransactionSupport,
  decodeNftTransferData,
  decodeManaTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress
}
