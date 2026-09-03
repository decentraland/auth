import { createPublicClient, custom, decodeFunctionData, formatEther, hexToString } from 'viem'
import { Rarity } from '@dcl/schemas'
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'
import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { Provider, connection } from 'decentraland-connect'
import { ContractName, getContract, getContractName } from 'decentraland-transactions'
import { config } from '../../../modules/config'
import {
  MetaTransactionTypedData,
  SimulationRequestBody,
  buildMetaTransactionSimulationPayload,
  isMetaTransactionTypedData,
  resolveMetaTransactionTypedData
} from '../../../shared/auth'
import { isMobile } from '../LoginPage/utils'
import { getUnsupportedCalldataAlias } from './transactionParams'
import { SignaturePayload, TypedDataPayload } from './types'

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const HEX_STRING_REGEX = /^0x([0-9a-fA-F]{2})*$/

// Wallet-RPC methods that request a signature rather than a transaction. `eth_sign` is kept here
// (and in extractSignaturePayload) for parser completeness and symmetry only — it is rejected
// upstream at recover by the method allowlist (assertMethodIsAllowed in signMethodGuard), so it
// never actually reaches this view-selection logic.
const SIGNATURE_METHODS = new Set(['personal_sign', 'eth_sign', 'eth_signtypeddata', 'eth_signtypeddata_v3', 'eth_signtypeddata_v4'])

/**
 * Returns true when the method is a plain signature request rather than a transaction.
 */
function isSignatureMethod(method: string): boolean {
  return SIGNATURE_METHODS.has(method.toLowerCase())
}

/**
 * Returns true when the address is a recognized Decentraland contract (present in the
 * decentraland-transactions registry), used to show a "verified" trust badge. This only
 * covers the static registry (MANA, marketplace, etc.), not dynamic collection contracts.
 */
function isKnownDecentralandContract(address: string): boolean {
  try {
    getContractName(address)
    return true
  } catch {
    return false
  }
}

/**
 * Extracts what a signature request asks the user to sign: a plain message (decoding
 * hex-encoded UTF-8 when possible) or an EIP-712 typed-data structure. Returns null when the
 * payload can't be interpreted.
 *
 * `signerAddress` (the connected account) is used to tell the message apart from the address
 * parameter: personal_sign is [message, address] and eth_sign is [address, message], but the
 * ordering isn't consistent across providers. Matching the known signer is robust even when the
 * message itself happens to look like an address; when no signer is available we fall back to a
 * shape heuristic (treat a leading address-shaped value as the address).
 */
function extractSignaturePayload(method: string, params: unknown[] | undefined, signerAddress?: string): SignaturePayload | null {
  if (!params || params.length === 0) return null
  const normalizedMethod = method.toLowerCase()

  if (normalizedMethod === 'personal_sign' || normalizedMethod === 'eth_sign') {
    const [first, second] = params
    const signer = signerAddress?.toLowerCase()
    let message: unknown = first
    if (typeof first === 'string' && typeof second === 'string') {
      if (signer && first.toLowerCase() === signer) {
        message = second
      } else if (signer && second.toLowerCase() === signer) {
        message = first
      } else if (ADDRESS_REGEX.test(first)) {
        message = second
      }
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

// EIP-712 primaryTypes known to grant a third party the ability to move the user's assets
// off-chain (token allowances, gasless transfers and marketplace order listings). These carry the
// same risk as an on-chain `approve`/`setApprovalForAll` but are invisible to a transaction
// simulation because no transaction is sent — so signing them must be gated behind an explicit
// acknowledgment. The list only tailors the wording: a primaryType that is neither here nor a
// MetaTransaction is treated as unrecognized and gated as well (see RequestPage).
const APPROVAL_GRANTING_PRIMARY_TYPES = new Set([
  'permit', // EIP-2612 (and DAI-style / ERC-4494 permits, same type name)
  'permitsingle', // Uniswap Permit2 (AllowanceTransfer)
  'permitbatch',
  'permittransferfrom', // Uniswap Permit2 (SignatureTransfer)
  'permitbatchtransferfrom',
  'permitwitnesstransferfrom', // Uniswap Permit2 (SignatureTransfer with witness)
  'permitbatchwitnesstransferfrom',
  'permitforall',
  'transferwithauthorization', // EIP-3009 gasless transfer (e.g. USDC): moves tokens outright
  'receivewithauthorization',
  'ordercomponents', // Seaport order
  'bulkorder', // Seaport bulk order
  'trade', // Decentraland off-chain marketplace order
  'order', // 0x, Blur, Rarible and other exchange orders
  'makerorder' // LooksRare order
])

/**
 * Returns true when a typed-data signature grants a third party control over the user's assets
 * (an off-chain allowance/permit or a marketplace order). Such signatures are not simulated, so
 * the approval UI must surface them as high-risk and require acknowledgment before signing.
 */
function isApprovalGrantingTypedData(typedData: TypedDataPayload | undefined | null): boolean {
  const primaryType = typedData?.primaryType
  return typeof primaryType === 'string' && APPROVAL_GRANTING_PRIMARY_TYPES.has(primaryType.toLowerCase())
}

// Control characters other than tab, newline and carriage return, plus U+FFFD, which is what
// decoding bytes that are not valid UTF-8 produces.
// eslint-disable-next-line no-control-regex
const UNREADABLE_CHARACTER_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/

// The size of a keccak256 digest — what a contract accepting EIP-191 signatures over a hash expects.
const DIGEST_BYTE_LENGTH = 32
// One unbroken run of hex, base64, base64url or dotted-token characters, at least 32 of them and
// nothing else: unprefixed hex hashes (64), base64 digests (43–44), UUIDs (36), JWT-like tokens.
// A sentence has spaces and punctuation outside this alphabet; a token does not.
const TOKEN_SHAPED_REGEX = /^[A-Za-z0-9+/=_.-]{32,}$/

/**
 * Returns true when a personal_sign message is not something the user can read and check:
 * - it is still raw hex (it could not be decoded as text);
 * - it decodes to bytes that are not text;
 * - it is exactly digest-sized (32 bytes), whatever those bytes look like — a hash whose bytes happen
 *   to be (or were ground to be) printable can contain a space as easily as a letter, so whitespace
 *   is no exemption;
 * - it is a single token-shaped run of characters: an unprefixed hex hash, a base64/base64url
 *   digest, a UUID or a JWT-like token. Signing the text form of a digest is not the same bytes as
 *   signing the digest, so this is not an on-chain authorization, but off-chain services do accept a
 *   signature over such a token as authorization, and the user cannot tell what it means either way.
 *
 * Such payloads may authorize something the screen cannot show, so they must not be signed on a
 * single click. The check runs on the decoded message on purpose: the wallet signs bytes, so a
 * hex-encoded message and its plaintext are the same signature, and whether the request arrived as
 * hex says nothing.
 */
function isOpaqueSignatureMessage(message: string): boolean {
  if (HEX_STRING_REGEX.test(message) || UNREADABLE_CHARACTER_REGEX.test(message)) {
    return true
  }
  if (new TextEncoder().encode(message).length === DIGEST_BYTE_LENGTH) {
    return true
  }
  return TOKEN_SHAPED_REGEX.test(message.trim())
}

/**
 * Detects a Decentraland meta-transaction typed-data payload and returns the inner call so it
 * can be simulated (from = message.from, to = domain.verifyingContract, data = the calldata field
 * the signed struct declares). Returns null when the typed data isn't a MetaTransaction.
 *
 * Throws MalformedSignatureRequestError when it is a MetaTransaction shaped in a way no
 * Decentraland contract signs. The recover guard already rejects those, but the check is repeated
 * here so the simulation can never be handed bytes the signature does not cover.
 */
function decodeMetaTransactionTypedData(typedData: TypedDataPayload | undefined, method: string): MetaTransactionTypedData | null {
  if (!isMetaTransactionTypedData(typedData)) return null
  return resolveMetaTransactionTypedData(typedData, method)
}

/**
 * Builds the simulation request body for an eth_sendTransaction request. When the transaction
 * will be relayed as a meta-transaction it must be simulated on the meta-transaction chain
 * (Polygon/Amoy) rather than the connected chain — simulating a meta-tx on mainnet would
 * revert spuriously. The caller passes `willUseMetaTransaction` (from checkMetaTransactionSupport)
 * so the meta-tx decision is made once and reused for the gas-coverage UI.
 */
function buildSendTransactionSimulationPayload(
  txParams: Record<string, unknown>,
  signerAddress: string,
  connectedChainId: number,
  willUseMetaTransaction: boolean
): SimulationRequestBody | null {
  const to = txParams.to as string | undefined
  if (!to) return null

  if (getUnsupportedCalldataAlias(txParams)) return null

  const data = (txParams.data as string | undefined) ?? '0x'

  if (willUseMetaTransaction) {
    // Relayed through the gas tank: preview the inner self-call the contract will make on the
    // meta-transaction chain, for the connected signer (the relay executes for the logged-in
    // account regardless of `params.from`) and without value (the relay forwards none).
    return buildMetaTransactionSimulationPayload(Number(getMetaTransactionChainId()), to, data, signerAddress)
  }

  return {
    chainId: connectedChainId,
    // Always simulate as the connected signer, never the request-supplied `from`. Web2 wallets
    // (Magic/Thirdweb) execute the transaction as the logged-in account regardless of
    // `params.from`, so honoring an attacker-chosen `from` would decouple the preview from what
    // actually executes: asset movements would be attributed to the other address (rendering the
    // "You send / You receive" summary empty and benign) while the connected account is what
    // really pays — and it would suppress approvalChanges, bypassing the high-risk approval gate.
    from: signerAddress,
    to,
    data,
    value: (txParams.value as string | undefined) ?? '0'
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
 * Validates if an address corresponds to a Decentraland contract address (including collections).
 * @param address The Ethereum address to validate
 * @returns true if the address is a valid Decentraland contract address, false otherwise
 */
async function isDecentralandContractAddress(address: string): Promise<boolean> {
  try {
    const transactionApiUrl = `${config.get('META_TRANSACTION_SERVER_URL')}/v1`
    // Bound the request: this gates the simulation loading state (which disables Approve) and also
    // runs on the approve path, so a hung meta-transaction server must not block the user forever.
    // A timeout rejects into the catch below and degrades to `false`, exactly like any fetch error.
    const response = await fetch(`${transactionApiUrl}/contracts/${address}`, { signal: AbortSignal.timeout(10_000) })

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
  const normalizedAddress = contractAddress.toLowerCase()
  try {
    const contractName = getContractName(contractAddress)
    // getContractName matches a Decentraland contract on ANY chain, but meta-transactions are only
    // relayed on the meta-tx chain (Polygon). Confirm the match is the deployment on that chain
    // before routing — otherwise a Decentraland contract address from another network (e.g. the
    // Ethereum-mainnet MANA/LAND address) would be rerouted as a Polygon meta-tx to a wrong or
    // nonexistent address and the user's transaction could never execute. If it is not on the
    // meta-tx chain, fall through to the tx-server collection check below.
    const contract = getContract(contractName, getMetaTransactionChainId())
    if (contract.address.toLowerCase() === normalizedAddress) {
      return { willUseMetaTransaction: true, contractName }
    }
  } catch {
    // Not in the static registry (or not deployed on the meta-tx chain) — fall through.
  }

  const isAcceptedAddress = await isDecentralandContractAddress(normalizedAddress)
  if (isAcceptedAddress) {
    return { willUseMetaTransaction: true, contractName: ContractName.ERC721CollectionV2 }
  }
  return { willUseMetaTransaction: false, contractName: null }
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
  isApprovalGrantingTypedData,
  getMetaTransactionChainId,
  checkMetaTransactionSupport,
  decodeNftTransferData,
  decodeManaTransferData,
  fetchNftMetadata,
  fetchPlaceByCreatorAddress,
  isSignatureMethod,
  isKnownDecentralandContract,
  extractSignaturePayload,
  decodeMetaTransactionTypedData,
  isOpaqueSignatureMessage,
  buildSendTransactionSimulationPayload
}
