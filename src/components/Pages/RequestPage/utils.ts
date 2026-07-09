import { createPublicClient, custom, decodeFunctionData, formatEther, hexToString } from 'viem'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { Provider, connection } from 'decentraland-connect'
import { ContractName, getContract, getContractName } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import { SimulationRequestBody } from '../../../shared/auth'
import { isMobile } from '../LoginPage/utils'
import { SignaturePayload, TypedDataPayload } from './types'

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const HEX_STRING_REGEX = /^0x([0-9a-fA-F]{2})*$/

/** Wallet-RPC methods that request a signature rather than a transaction. */
const SIGNATURE_METHODS = new Set(['personal_sign', 'eth_sign', 'eth_signtypeddata', 'eth_signtypeddata_v3', 'eth_signtypeddata_v4'])

/**
 * Returns true when the method is a plain signature request (not a transaction and not the
 * dedicated dcl_personal_sign sign-in flow).
 */
function isSignatureMethod(method: string): boolean {
  return SIGNATURE_METHODS.has(method.toLowerCase())
}

/**
 * Extracts what a signature request asks the user to sign: a plain message (decoding
 * hex-encoded UTF-8 when possible) or an EIP-712 typed-data structure. Returns null when the
 * payload can't be interpreted.
 */
function extractSignaturePayload(method: string, params: unknown[] | undefined): SignaturePayload | null {
  if (!params || params.length === 0) return null
  const normalizedMethod = method.toLowerCase()

  if (normalizedMethod === 'personal_sign' || normalizedMethod === 'eth_sign') {
    // personal_sign is [message, address]; eth_sign is [address, message]. Pick the element
    // that is not a bare address as the message.
    const [first, second] = params
    let message: unknown = first
    if (typeof first === 'string' && ADDRESS_REGEX.test(first) && typeof second === 'string') {
      message = second
    }
    if (typeof message !== 'string') return null

    let text = message
    if (HEX_STRING_REGEX.test(message) && message.length > 2) {
      try {
        text = hexToString(message as `0x${string}`)
      } catch {
        text = message
      }
    }
    return { kind: 'message', message: text }
  }

  // eth_signTypedData variants. v3/v4 pass [address, jsonString]; some providers pass an object.
  const jsonCandidate = params.find(param => typeof param === 'string' && !ADDRESS_REGEX.test(param))
  if (typeof jsonCandidate === 'string') {
    try {
      const parsed = JSON.parse(jsonCandidate) as TypedDataPayload
      return { kind: 'typedData', typedData: parsed, raw: jsonCandidate }
    } catch {
      return { kind: 'message', message: jsonCandidate }
    }
  }
  const objectCandidate = params.find(param => typeof param === 'object' && param !== null)
  if (objectCandidate) {
    return { kind: 'typedData', typedData: objectCandidate as TypedDataPayload, raw: JSON.stringify(objectCandidate, null, 2) }
  }
  return null
}

/**
 * Detects a Decentraland meta-transaction typed-data payload and returns the inner call so it
 * can be simulated (from = message.from, to = domain.verifyingContract, data =
 * message.functionSignature). Returns null when the typed data isn't a MetaTransaction.
 */
function decodeMetaTransactionTypedData(
  typedData: TypedDataPayload | undefined
): { from: string; verifyingContract: string; functionSignature: string; chainId: number } | null {
  try {
    if (!typedData || typedData.primaryType !== 'MetaTransaction') return null
    const message = typedData.message
    const domain = typedData.domain
    if (!message || !domain) return null

    const from = message.from
    const functionSignature = message.functionSignature
    const verifyingContract = domain.verifyingContract
    if (typeof from !== 'string' || typeof functionSignature !== 'string' || typeof verifyingContract !== 'string') {
      return null
    }

    let chainId: number | undefined
    if (typeof domain.salt === 'string') {
      try {
        chainId = Number(BigInt(domain.salt))
      } catch {
        chainId = undefined
      }
    }
    if ((chainId === undefined || Number.isNaN(chainId)) && domain.chainId !== undefined) {
      chainId = Number(domain.chainId)
    }
    if (chainId === undefined || Number.isNaN(chainId)) return null

    return { from, verifyingContract, functionSignature, chainId }
  } catch {
    return null
  }
}

/**
 * Builds the simulation request body for an eth_sendTransaction request. When the target is a
 * Decentraland contract the transaction is relayed as a meta-transaction, so it must be
 * simulated on the meta-transaction chain (Polygon/Amoy) rather than the connected chain —
 * simulating a meta-tx on mainnet would revert spuriously.
 */
async function buildSendTransactionSimulationPayload(
  txParams: Record<string, unknown>,
  signerAddress: string,
  connectedChainId: number
): Promise<SimulationRequestBody | null> {
  const to = txParams.to as string | undefined
  if (!to) return null

  const { willUseMetaTransaction } = await checkMetaTransactionSupport(to)
  const chainId = willUseMetaTransaction ? Number(getMetaTransactionChainId()) : connectedChainId

  return {
    chainId,
    from: (txParams.from as string | undefined) ?? signerAddress,
    to,
    data: (txParams.data as string | undefined) ?? '0x',
    value: (txParams.value as string | undefined) ?? '0'
  }
}

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

// Query params every client deep link carries: dclenv on non-production environments and
// the bridge-only flag when the auth site was opened with it.
function getDeeplinkQueryParams(bridgeOnly?: boolean): URLSearchParams {
  const env = config.get('ENVIRONMENT').toLowerCase()
  const params = new URLSearchParams()
  if (env !== 'production') {
    params.set('dclenv', env === 'development' ? 'zone' : env)
  }
  if (bridgeOnly) {
    params.set('bridge-only', 'true')
  }
  return params
}

// Builds the bare client deep link (e.g. after the traditional signing flow completes).
function getExplorerDeeplink(deepLink?: string, bridgeOnly?: boolean): string {
  const base = deepLink || 'decentraland://'
  const query = getDeeplinkQueryParams(bridgeOnly).toString()
  return query ? `${base}?${query}` : base
}

// Builds the `open?signin=<identityId>` deep link that hands a posted identity to the
// client, carrying the same query params (dclenv, bridge-only) as the bare deep link.
// Seeding signin into the URLSearchParams encodes the id and keeps a single `?`-joined query.
function getSigninDeeplink(deepLink: string | undefined, identityId: string, bridgeOnly?: boolean): string {
  const params = new URLSearchParams({ signin: identityId })
  getDeeplinkQueryParams(bridgeOnly).forEach((value, key) => params.set(key, value))
  return `${deepLink || 'decentraland://'}open?${params.toString()}`
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
    const publicClient = createPublicClient({ transport: custom(connectedProvider) })
    const connectedChainId = await publicClient.getChainId()
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

    // Decode the transaction data using the ABI
    const { args } = decodeFunctionData({
      abi: contractABI as readonly unknown[],
      data: data as `0x${string}`
    })

    if (!args || args.length < 3) {
      console.error('Failed to decode transaction data')
      return null
    }

    // All ERC721 transfer methods have these parameters:
    // transferFrom(address from, address to, uint256 tokenId)
    // safeTransferFrom(address from, address to, uint256 tokenId)
    // safeTransferFrom(address from, address to, uint256 tokenId, bytes data)
    const toAddress = args[1] as string // 'to' address is always the second parameter
    const tokenId = (args[2] as bigint).toString() // tokenId is always the third parameter

    return { tokenId, toAddress }
  } catch (error) {
    console.error('Error decoding NFT transfer data:', error)
    return null
  }
}

/**
 * Decodes MANA (ERC20) transfer data to extract amount and destination address.
 * Only decodes when the transaction targets the canonical MANA token contract, so an
 * arbitrary ERC20 transfer can't be presented to the user as a MANA tip.
 * @param data The transaction data
 * @param contractAddress The transaction `to` address (the token contract being called)
 * @returns Object containing manaAmount and toAddress, or null if decoding fails
 */
function decodeManaTransferData(data: string, contractAddress: string): { manaAmount: string; toAddress: string } | null {
  try {
    if (!data || data.length < 10) return null
    if (!contractAddress) return null

    // ERC20 transfer function signature: transfer(address to, uint256 amount)
    const transferFunctionSignature = '0xa9059cbb'

    // Check if this is a transfer function call
    if (!data.startsWith(transferFunctionSignature)) {
      return null
    }

    // Only treat this as a MANA transfer if it targets the canonical MANA token contract.
    // Without this, any ERC20 transfer (`transfer(to, amount)`) would be mislabeled as MANA
    // and its amount mis-formatted (formatEther assumes 18 decimals).
    const manaContract = getContract(ContractName.MANAToken, getMetaTransactionChainId())
    if (contractAddress.toLowerCase() !== manaContract.address.toLowerCase()) {
      return null
    }

    const contract = getContract(ContractName.ERC20, getMetaTransactionChainId())

    const { args } = decodeFunctionData({
      abi: contract.abi as readonly unknown[],
      data: data as `0x${string}`
    })

    if (!args || args.length < 2) {
      console.error('Failed to decode MANA transfer data')
      return null
    }

    const toAddress = args[0] as string
    const amount = args[1] as bigint

    // Convert from wei to MANA (18 decimals)
    const manaAmount = formatEther(amount)

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
  const publicClient = createPublicClient({ transport: custom(networkProvider) })

  // Use the provided contract ABI to interact with the NFT contract
  const tokenUri = (await publicClient.readContract({
    address: contractAddress as `0x${string}`,
    abi: contractABI as readonly unknown[],
    functionName: 'tokenURI',
    args: [BigInt(tokenId)]
  })) as string

  if (!tokenUri) {
    throw new Error(`No tokenURI returned for token ${tokenId} at contract ${contractAddress}`)
  }

  // The tokenURI comes from an arbitrary (attacker-chosen) contract, so only allow http(s)
  // before fetching. This blocks schemes like javascript:/data:/file: from being passed to fetch.
  const metadataUrl = tokenUri

  let metadataProtocol: string
  try {
    metadataProtocol = new URL(metadataUrl).protocol
  } catch {
    throw new Error(`Invalid tokenURI for token ${tokenId} at contract ${contractAddress}`)
  }
  if (metadataProtocol !== 'https:' && metadataProtocol !== 'http:') {
    throw new Error(`Unsupported tokenURI scheme "${metadataProtocol}" for token ${tokenId} at contract ${contractAddress}`)
  }

  // Fetch the metadata JSON
  const metadataResponse = await fetch(metadataUrl)
  if (!metadataResponse.ok) {
    throw new Error(`Failed to fetch metadata from ${metadataUrl}: ${metadataResponse.status} ${metadataResponse.statusText}`)
  }

  const metadata = await metadataResponse.json()

  // The metadata comes from an attacker-controllable contract/URL, so only surface http(s)
  // image URLs. This drops data:/other-scheme values as defense-in-depth (the actual transfer
  // token/recipient come from the decoded tx, not this cosmetic field); a dropped image just
  // falls back to the view's placeholder rather than breaking it.
  const rawImageUrl = metadata.image || metadata.image_url
  let imageUrl = ''
  if (typeof rawImageUrl === 'string') {
    try {
      const imageProtocol = new URL(rawImageUrl).protocol
      if (imageProtocol === 'https:' || imageProtocol === 'http:') {
        imageUrl = rawImageUrl
      }
    } catch {
      // Ignore malformed image URLs — leave imageUrl empty.
    }
  }

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
      return null
    }

    // Only return place data if exactly one place is found
    if (data.data.length !== 1) {
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
  getExplorerDeeplink,
  getSigninDeeplink,
  getConnectedProvider,
  getNetworkProvider,
  isDecentralandContractAddress,
  getMetaTransactionChainId,
  checkMetaTransactionSupport,
  decodeNftTransferData,
  decodeManaTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  isSignatureMethod,
  extractSignaturePayload,
  decodeMetaTransactionTypedData,
  buildSendTransactionSimulationPayload
}
