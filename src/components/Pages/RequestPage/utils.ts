import { createPublicClient, custom, formatEther } from 'viem'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { Provider, connection } from 'decentraland-connect'
import { ContractName, getContract } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import { DecodedCall, collectCallAddresses } from '../../../shared/auth'
import { isErrorWithMessage } from '../../../shared/errors'
import { ResponseTooLargeError, readTextWithCap } from '../../../shared/http'
import { formatUntrustedLabel } from '../../../shared/text'
import { getHttpsUrl } from '../../../shared/urls'
import { isRecord } from '../../../shared/utils/isRecord'
import { isMobile } from '../LoginPage/utils'
import { NFT_TRANSFER_FUNCTIONS } from './classifyRequest'
import type { PlaceLocation } from './types'

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
// The most metadata JSON the gift view reads for one token. Real collection metadata is a few kilobytes.
const MAX_METADATA_BYTES = 256 * 1024
// A tokenURI host that does not answer must not hold the gift view's upgrade open forever.
const METADATA_FETCH_TIMEOUT_MS = 10_000

/** Rejects when `promise` has not settled within `timeoutMs`. */
function withTimeout<T>(promise: PromiseLike<T> | T, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    // Resolve the value first so a synchronous or already-settled result goes through the same path.
    Promise.resolve(promise).then(
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
 * Confirms that a recipient has no code using Decentraland's RPC on the transaction's chain.
 * Only the exact empty-code response is a positive answer; deployed and delegated code, malformed
 * responses and lookup failures must not produce a simple-transfer review. The deadline covers
 * provider creation as well as the RPC request so classification cannot hang on either step.
 */
async function isAddressWithoutCode(address: string, chainId: number): Promise<boolean> {
  const lookup = async () => {
    const networkProvider = await getTrustedNetworkProvider(chainId as ChainId)
    const publicClient = createPublicClient({ transport: custom(networkProvider) })
    const code = await publicClient.request({ method: 'eth_getCode', params: [address as `0x${string}`, 'latest'] })
    return code === '0x'
  }
  return withTimeout(lookup(), COLLECTION_LOOKUP_TIMEOUT_MS, 'Recipient code lookup')
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
  // The provider is created under the same deadline as the reads, like isAddressWithoutCode does, so the
  // classification cannot hang on either step.
  const networkProvider = await withTimeout(getTrustedNetworkProvider(chainId), COLLECTION_LOOKUP_TIMEOUT_MS, 'Collection factory provider')
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

/**
 * Reads the sender, the recipient and the token id out of a decoded ERC-721 transfer. Only `transferFrom`
 * and a `safeTransferFrom` carrying no data qualify: the branded gift view describes exactly those, so any
 * other call is left to the generic review of the raw payload.
 * @param call The call decoded against the collection ABI
 * @returns The transfer source, destination and token id, or null when the call is not the plain transfer of one token
 */
function decodeNftTransferData(call: DecodedCall): { fromAddress: string; tokenId: string; toAddress: string } | null {
  if (!NFT_TRANSFER_FUNCTIONS.has(call.functionName)) {
    return null
  }

  // transferFrom(address from, address to, uint256 tokenId)
  // safeTransferFrom(address from, address to, uint256 tokenId)
  // safeTransferFrom(address from, address to, uint256 tokenId, bytes data)
  const [fromAddress, toAddress, tokenId, data] = call.args
  if (typeof fromAddress !== 'string' || typeof toAddress !== 'string' || typeof tokenId !== 'bigint') {
    console.error('Failed to decode transaction data')
    return null
  }
  // A safe transfer that hands the recipient data is more than the gift of a token: the generic review shows
  // those bytes, the gift screen would not.
  if (data !== undefined && data !== '0x') {
    return null
  }

  return { fromAddress, tokenId: tokenId.toString(), toAddress }
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** The counterparties of a decoded call, and whether part of what it reaches could not be read. */
type Counterparties = { addresses: string[]; opaque: boolean }

/**
 * Every address a decoded Decentraland call may invoke, other than the zero address, lowercased and
 * deduplicated. The reviewing signer's address remains included: it may itself contain contract-wallet
 * code, and ownership of the address is not evidence that the code is safe to omit from the review.
 * A Decentraland contract calls the addresses it is given: a collection
 * calls the recipient of a safe transfer (`onERC721Received`), the marketplaces and bids call the NFT
 * registry of an order (`ownerOf`, `safeTransferFrom`, a fingerprint check), the credits manager runs the
 * marketplace call nested in its `externalCall`. Whatever code sits there runs inside the transaction and
 * can do what the arguments never say, so the review can stand behind the arguments only when every such
 * address is a Decentraland contract or has no code, and nothing the call carries went unread; the request
 * is refused otherwise (see verifyCounterparties and collectCallAddresses). Arrays, structs and declared
 * nested calls are walked; a plain `bytes` argument is not a call (the one that deploys code,
 * `createCollection`, is a deliberate exception noted next to FORWARDING_FUNCTIONS).
 */
function getCounterpartyAddresses(call: DecodedCall, chainId: number): Counterparties {
  const { addresses, opaque } = collectCallAddresses(call, chainId)
  addresses.delete(ZERO_ADDRESS)
  return { addresses: [...addresses], opaque }
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

  // The tokenURI comes from a contract the request chose, so only an absolute https URL is fetched:
  // no other scheme, and no plain http, which could point the user's browser at a LAN host from the
  // auth origin.
  const metadataUrl = getHttpsUrl(tokenUri)
  if (!metadataUrl) {
    throw new Error(`Unsupported tokenURI for token ${tokenId} at contract ${contractAddress}`)
  }

  // Fetch the metadata JSON, bounded in time and in size: a declared or streamed body beyond the cap is
  // never buffered, let alone parsed.
  const metadataResponse = await fetch(metadataUrl, { signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS) })
  if (!metadataResponse.ok) {
    // Drain the body so the connection can be reused; ignore failures doing so.
    await metadataResponse.body?.cancel().catch(() => undefined)
    throw new Error(`Failed to fetch metadata from ${metadataUrl}: ${metadataResponse.status} ${metadataResponse.statusText}`)
  }
  const declaredLength = Number(metadataResponse.headers?.get('content-length') ?? 0)
  if (declaredLength > MAX_METADATA_BYTES) {
    await metadataResponse.body?.cancel().catch(() => undefined)
    throw new Error(`Metadata for token ${tokenId} at contract ${contractAddress} is too large (${declaredLength} bytes)`)
  }
  let metadataText: string
  try {
    metadataText = await readTextWithCap(metadataResponse, MAX_METADATA_BYTES)
  } catch (e) {
    const detail = isErrorWithMessage(e) ? e.message : 'unknown'
    throw new Error(
      e instanceof ResponseTooLargeError
        ? `Metadata for token ${tokenId} at contract ${contractAddress} is too large: ${detail}`
        : `Metadata for token ${tokenId} at contract ${contractAddress} could not be read: ${detail}`
    )
  }
  const metadata: unknown = JSON.parse(metadataText)
  if (!isRecord(metadata)) {
    throw new Error(`Metadata for token ${tokenId} at contract ${contractAddress} is not an object`)
  }

  // The metadata comes from a URL the request chose, so its image is shown only when it is an absolute
  // https URL (the transfer's token and recipient come from the decoded call, not from this cosmetic
  // field; a dropped image falls back to the view's placeholder), and its texts are shown as untrusted
  // labels: hidden characters revealed and length capped.
  const imageUrl = getHttpsUrl(metadata.image ?? metadata.image_url) ?? ''

  // Extract rarity from attributes. Cosmetic: it only picks the frame the item is shown in, and an
  // unknown value is common.
  let rarity: Rarity = Rarity.COMMON
  if (Array.isArray(metadata.attributes)) {
    const rarityAttribute: unknown = metadata.attributes.find(
      (attribute: unknown) => isRecord(attribute) && attribute.trait_type === 'Rarity'
    )
    if (isRecord(rarityAttribute) && typeof rarityAttribute.value === 'string') {
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
    name: formatUntrustedLabel(metadata.name, 64),
    description: formatUntrustedLabel(metadata.description, 200),
    rarity
  }
}

/** A Genesis City parcel: two integers, as the Places API writes a base position. */
const BASE_POSITION_PATTERN = /^-?\d{1,4},-?\d{1,4}$/

/**
 * The place's location, or null when the API describes one that names no place the user could be in.
 *
 * A Genesis City position is worth showing only if the recipient provably controls it, and the protocol
 * does guarantee that: a scene's `base` must be one of its `parcels` (SceneParcels), those parcels must
 * equal the deployment's pointers (sceneParcelsMatchPointersValidateFn), and a deployment is refused
 * unless its deployer holds LAND over every pointer (checkLAND).
 *
 * The position is still read back from `positions` — the pointers themselves — rather than from
 * `base_position`, which the Places service takes from the scene's own metadata. The guarantee belongs to
 * the deployment path, and this is a row from a service that has been storing them since before that path
 * looked the way it does now, so it is checked instead of trusted. The declared
 * base is used whenever it is one of the pointers, which for anything the validator has seen is always.
 */
function getPlaceLocation(place: {
  world?: unknown
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the Places API's own field names
  world_name?: unknown
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the Places API's own field names
  base_position?: unknown
  positions?: unknown
}): PlaceLocation | null {
  if (place.world === true) {
    // A world's base position is always "0,0" and says nothing; its name is what addresses it, and a world
    // is deployed under a NAME its deployer owns.
    const name = formatUntrustedLabel(place.world_name, 64)
    return name ? { kind: 'world', name } : null
  }
  const owned = Array.isArray(place.positions) ? place.positions.filter((p): p is string => typeof p === 'string') : []
  const parcels = owned.map(parcel => parcel.trim()).filter(parcel => BASE_POSITION_PATTERN.test(parcel))
  if (parcels.length === 0) {
    return null
  }
  const declared = typeof place.base_position === 'string' ? place.base_position.trim() : ''
  return { kind: 'genesis', position: parcels.includes(declared) ? declared : parcels[0] }
}

/**
 * Fetches place information by creator address from the Places API
 * @param creatorAddress The creator's Ethereum address
 * @returns Object containing place name, image URL and location if exactly one identifiable place is
 * found, null otherwise
 */
async function fetchPlaceByCreatorAddress(
  creatorAddress: string
): Promise<{ sceneName: string; sceneImageUrl: string; sceneLocation: PlaceLocation } | null> {
  try {
    const placesApiUrl = config.get('PLACES_API_URL')
    const response = await fetch(`${placesApiUrl}/api/places?creator_address=${creatorAddress.toLowerCase()}`)

    if (!response.ok) {
      console.error(`Failed to fetch place info from Places API: ${response.status} ${response.statusText}`)
      // Drain the body so the connection can be reused; ignore failures doing so.
      await response.body?.cancel().catch(() => undefined)
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

    // A place nothing locates is not worth showing: the title and the image are the parts anyone can copy,
    // so without the parcel or the world name there is nothing on the block the user could check. Treated
    // like no place at all, which the tip view already shows as an unnamed one.
    const sceneLocation = getPlaceLocation(place)
    if (!sceneLocation) {
      return null
    }

    // The place's title and image are written by whoever deployed the scene at the recipient the request
    // chose, and sit next to the amount the user confirms: shown as an untrusted label and an https image.
    return {
      sceneName: formatUntrustedLabel(place.title) || 'Unknown Place',
      sceneImageUrl: getHttpsUrl(place.image) ?? '',
      sceneLocation
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
  isAddressWithoutCode,
  isDecentralandCollection,
  getMetaTransactionChainId,
  decodeNftTransferData,
  getCounterpartyAddresses,
  decodeManaTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  getPlaceLocation
}
