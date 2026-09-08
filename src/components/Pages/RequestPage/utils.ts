import { createPublicClient, custom, formatEther } from 'viem'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { Provider, connection } from 'decentraland-connect'
import { ContractName, getContract } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import { DecodedCall, SimulationRequestBody, SimulationResponseBody, buildMetaTransactionSimulationPayload } from '../../../shared/auth'
import { isMobile } from '../LoginPage/utils'
import { RequestClassification } from './classifyRequest'

/**
 * Builds the simulation request body for a Decentraland transaction. A relayed call is previewed the way
 * the contract will execute it on the meta-transaction chain (the contract calling itself with the signer
 * appended, no value); a plain call is previewed on the connected chain as the connected signer, never as
 * the request-supplied `from`, which web2 wallets ignore anyway and which would otherwise let the preview
 * attribute the effects to another account.
 */
function buildSendTransactionSimulationPayload(
  transaction: Extract<RequestClassification, { kind: 'dcl_transaction' }>,
  signerAddress: string
): SimulationRequestBody {
  if (transaction.relayed) {
    return buildMetaTransactionSimulationPayload(transaction.chainId, transaction.to, transaction.data, signerAddress)
  }
  return {
    chainId: transaction.chainId,
    from: signerAddress,
    to: transaction.to,
    data: transaction.data,
    // The same canonical hex the wallet is dispatched (see buildTransactionParams).
    value: transaction.value
  }
}

// Native-protocol confirmation dialogs need enough time for the user to react. A 500 ms window
// produced false negatives: the timeout could render the failure view while the browser prompt
// was still open, and the app would then launch after the user accepted it.
const DEEPLINK_DETECTION_TIMEOUT = 5000

/**
 * Attempts to launch a deep link and detects if the app handled it.
 * Uses browser lifecycle signals to infer that control was handed to the app.
 * Returns true if app was detected, false otherwise.
 */
const launchDeepLink = (url: string): Promise<boolean> => {
  return new Promise(resolve => {
    if (isMobile()) {
      window.location.href = url
      resolve(true)
      return
    }

    // Create a hidden iframe to trigger the deep link
    // This avoids Safari redirecting to an invalid URL if app is not installed
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'display: none')
    iframe.src = url

    let settled = false
    // Initialized separately so cleanup never closes over a binding in its temporal dead zone.
    // This also keeps cleanup safe if a future refactor can settle before the timer is armed.
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined

    const cleanup = () => {
      window.removeEventListener('blur', handleAppLaunch)
      window.removeEventListener('pagehide', handleAppLaunch)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      iframe.remove()
    }

    const settle = (wasLaunched: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(wasLaunched)
    }

    const handleAppLaunch = () => settle(true)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        settle(true)
      }
    }

    window.addEventListener('blur', handleAppLaunch)
    window.addEventListener('pagehide', handleAppLaunch)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    timeoutId = setTimeout(() => settle(false), DEEPLINK_DETECTION_TIMEOUT)
    document.body.appendChild(iframe)
  })
}

// Query params every client deep link carries: dclenv on non-production environments, the
// bridgeOnly flag, and the authRequestId value when the auth site was opened with them.
function getDeeplinkQueryParams(bridgeOnly?: boolean, authRequestId?: string | null): URLSearchParams {
  const env = config.get('ENVIRONMENT').toLowerCase()
  const params = new URLSearchParams()
  if (env !== 'production') {
    params.set('dclenv', env === 'development' ? 'zone' : env)
  }
  if (bridgeOnly) {
    params.set('bridgeOnly', 'true')
  }
  if (authRequestId) {
    params.set('authRequestId', authRequestId)
  }
  return params
}

// Builds the bare client deep link (e.g. after the traditional signing flow completes).
function getExplorerDeeplink(deepLink?: string, bridgeOnly?: boolean, authRequestId?: string | null): string {
  const base = deepLink || 'decentraland://'
  const query = getDeeplinkQueryParams(bridgeOnly, authRequestId).toString()
  return query ? `${base}?${query}` : base
}

// Builds the `open?signin=<identityId>` deep link that hands a posted identity to the
// client, carrying the same query params (dclenv, bridgeOnly, authRequestId) as the bare
// deep link. Seeding signin into the URLSearchParams encodes the id and keeps a single
// `?`-joined query.
function getSigninDeeplink(deepLink: string | undefined, identityId: string, bridgeOnly?: boolean, authRequestId?: string | null): string {
  const params = new URLSearchParams({ signin: identityId })
  getDeeplinkQueryParams(bridgeOnly, authRequestId).forEach((value, key) => params.set(key, value))
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
 * Decentraland's own RPC for a chain, never the connected wallet's. Reads that decide what the page
 * vouches for (which contracts are collections, what a token looks like) must not go through a provider
 * the user may have been talked into repointing.
 */
function getTrustedNetworkProvider(chainId: ChainId): Promise<Provider> {
  return connection.createProvider(ProviderType.NETWORK, chainId)
}

const COLLECTION_FACTORIES = [ContractName.CollectionFactory, ContractName.CollectionFactoryV3]
// A hung RPC must not hold the request page on its spinner. After this long the lookup is given up (the
// RPC call itself is not aborted; the provider offers no handle for that) and the classifier treats the
// answer as unavailable.
const COLLECTION_LOOKUP_TIMEOUT_MS = 10_000

/** Rejects when `promise` has not settled within `timeoutMs`. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Whether a Decentraland collection factory on the meta-transaction chain deployed `contractAddress`,
 * asked of the factories themselves through Decentraland's own RPC. This is the whitelist for wearable
 * collections, which are deployed per collection and are not in the static registry: a factory-deployed
 * proxy runs Decentraland's reviewed collection code, so the collection ABI describes exactly what a call
 * to it does. Throws when no factory said yes and a lookup failed or timed out, so an outage is reported
 * as unavailable and never read as a verdict.
 * @param contractAddress The address to check
 */
async function isDecentralandCollection(contractAddress: string): Promise<boolean> {
  const chainId = getMetaTransactionChainId()
  const factories = COLLECTION_FACTORIES.flatMap(name => {
    try {
      return [getContract(name, chainId)]
    } catch {
      return []
    }
  })
  if (factories.length === 0) {
    return false
  }

  // Note what "a factory deployed it" covers: every curated collection, third-party creators' included.
  // The branded gift frame is therefore available to any approved creator's collection, and what it says
  // stays true for all of them — exactly one token the signer holds leaves their account.
  const networkProvider = await getTrustedNetworkProvider(chainId)
  const publicClient = createPublicClient({ transport: custom(networkProvider) })
  const answers = await Promise.allSettled(
    factories.map(factory =>
      withTimeout(
        publicClient.readContract({
          address: factory.address as `0x${string}`,
          abi: factory.abi as readonly unknown[],
          functionName: 'isCollectionFromFactory',
          args: [contractAddress]
        }) as Promise<boolean>,
        COLLECTION_LOOKUP_TIMEOUT_MS,
        'Collection factory lookup'
      )
    )
  )
  // One factory saying yes is the whole answer, whatever happened to the other lookup. Only when no
  // factory said yes does a failed lookup matter: then nothing vouched for the contract and nothing
  // ruled it out either, and an outage must not be read as a verdict.
  if (answers.some(answer => answer.status === 'fulfilled' && answer.value === true)) {
    return true
  }
  const failure = answers.find((answer): answer is PromiseRejectedResult => answer.status === 'rejected')
  if (failure) {
    throw failure.reason
  }
  return false
}

/**
 * Gets the appropriate chain ID based on the environment.
 * @returns ChainId.MATIC_MAINNET for production/staging, ChainId.MATIC_AMOY otherwise
 */
function getMetaTransactionChainId(): ChainId {
  return ['production', 'staging'].includes(config.get('ENVIRONMENT').toLowerCase()) ? ChainId.MATIC_MAINNET : ChainId.MATIC_AMOY
}

// The only collection calls the branded "gift" view may stand in for. Other functions on the
// CollectionV2 ABI also take three or more arguments — batchTransferFrom, safeBatchTransferFrom,
// setItemsMinters, setItemsManagers, editItemsData — and would decode into a "to" and a "token id" as
// well, so without this check they would be shown as the gift of one token while doing something else.
const NFT_TRANSFER_FUNCTIONS = new Set(['transferFrom', 'safeTransferFrom'])

/**
 * Reads the sender, the recipient and the token id out of a decoded ERC-721 transfer. Only `transferFrom`
 * and `safeTransferFrom` qualify: the branded gift view previews exactly those, so any other call is left
 * to the generic review and its simulation.
 * @param call The call decoded against the collection ABI
 * @returns The transfer source, destination and token id, or null when the call is not a single-token transfer
 */
function decodeNftTransferData(call: DecodedCall): { fromAddress: string; tokenId: string; toAddress: string } | null {
  if (!NFT_TRANSFER_FUNCTIONS.has(call.functionName)) {
    return null
  }

  // transferFrom(address from, address to, uint256 tokenId)
  // safeTransferFrom(address from, address to, uint256 tokenId)
  // safeTransferFrom(address from, address to, uint256 tokenId, bytes data)
  const [fromAddress, toAddress, tokenId] = call.args
  if (typeof fromAddress !== 'string' || typeof toAddress !== 'string' || typeof tokenId !== 'bigint') {
    console.error('Failed to decode transaction data')
    return null
  }

  return { fromAddress, tokenId: tokenId.toString(), toAddress }
}

/** Whether two token ids name the same token, whatever notation each side uses (decimal, hex). */
function isSameTokenId(left: string | null, right: string): boolean {
  if (left === null) {
    return false
  }
  try {
    return BigInt(left) === BigInt(right)
  } catch {
    return false
  }
}

/**
 * Whether a simulation shows the branded NFT view to describe every visible effect of the transaction.
 * `safeTransferFrom` can invoke an arbitrary receiver callback, so recognizing the collection and the
 * selector is not enough: any additional transfer, approval, or event from a contract other than the
 * collection must use the generic summary instead of being hidden behind the specialized gift screen.
 * A receiver acting on a permission it already holds emits only its own events, which is why those are
 * judged too. Net dollar changes are not: the token leaving the account is one, and it is expected.
 *
 * The token id is compared numerically because the two sides come from different sources: the decoder
 * prints the calldata's uint256 in decimal, while the preview server passes the simulator's notation
 * through. A notation difference must not silently hide the gift view for every transfer.
 */
function isExactNftTransferSimulation(
  result: SimulationResponseBody,
  signerAddress: string,
  contractAddress: string,
  transfer: { fromAddress: string; tokenId: string; toAddress: string }
): boolean {
  const signer = signerAddress.toLowerCase()
  const collection = contractAddress.toLowerCase()
  if (
    result.status !== 'success' ||
    transfer.fromAddress.toLowerCase() !== signer ||
    result.assetChanges.length !== 1 ||
    result.approvalChanges.length !== 0 ||
    (result.events ?? []).some(event => event.address.toLowerCase() !== collection)
  ) {
    return false
  }

  const [change] = result.assetChanges
  return (
    change.type === 'transfer' &&
    change.standard === 'erc721' &&
    change.from?.toLowerCase() === signer &&
    change.to?.toLowerCase() === transfer.toAddress.toLowerCase() &&
    change.contractAddress?.toLowerCase() === collection &&
    isSameTokenId(change.tokenId, transfer.tokenId)
  )
}

/**
 * Reads the amount and the destination out of a decoded MANA `transfer`. The caller has already
 * established that the call targets the canonical MANA token, so this only shapes the arguments.
 * @param call The call decoded against the MANA ABI
 * @returns Object containing manaAmount and toAddress, or null when the call is not a transfer
 */
function decodeManaTransferData(call: DecodedCall): { manaAmount: string; toAddress: string } | null {
  // transfer(address to, uint256 amount)
  if (call.functionName !== 'transfer') {
    return null
  }
  const [toAddress, amount] = call.args
  if (typeof toAddress !== 'string' || typeof amount !== 'bigint') {
    console.error('Failed to decode MANA transfer data')
    return null
  }

  // Convert from wei to MANA (18 decimals)
  return { manaAmount: formatEther(amount), toAddress }
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
  contractABI: readonly unknown[],
  tokenId: string
): Promise<{ imageUrl: string; name: string; description: string; rarity: Rarity }> {
  // Read through Decentraland's own RPC for the collection chain (Polygon/Amoy): the user's wallet may be
  // on another network, and a wallet RPC is not a source the branded view should trust for what it shows.
  const chainId = getMetaTransactionChainId()
  const networkProvider = await getTrustedNetworkProvider(chainId)
  const publicClient = createPublicClient({ transport: custom(networkProvider) })

  // Use the provided contract ABI to interact with the NFT contract
  const tokenUri = (await publicClient.readContract({
    address: contractAddress as `0x${string}`,
    abi: contractABI,
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
  isDecentralandCollection,
  getMetaTransactionChainId,
  decodeNftTransferData,
  isExactNftTransferSimulation,
  decodeManaTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  buildSendTransactionSimulationPayload
}
