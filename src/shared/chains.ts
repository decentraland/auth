/** What the request page knows about a chain it can review a request on. */
type SupportedChain = {
  /** Human-readable network name (e.g. "Polygon"). */
  name: string
  /** Symbol of the native currency (e.g. "POL"). */
  nativeSymbol: string
  /** Name of the block explorer (e.g. "Polygonscan"). */
  explorerName: string
  /** Base URL of the block explorer, without a trailing slash. */
  explorerBaseUrl: string
}

/**
 * The chains the auth-server simulator can preview a call on, and everything the page says about
 * them. The one place both the contract index and the display helpers read from, so a chain cannot
 * be previewable but unnamed, or named but not indexed.
 */
const SUPPORTED_CHAINS: ReadonlyMap<number, SupportedChain> = new Map([
  [1, { name: 'Ethereum', nativeSymbol: 'ETH', explorerName: 'Etherscan', explorerBaseUrl: 'https://etherscan.io' }],
  [11155111, { name: 'Ethereum Sepolia', nativeSymbol: 'ETH', explorerName: 'Etherscan', explorerBaseUrl: 'https://sepolia.etherscan.io' }],
  [137, { name: 'Polygon', nativeSymbol: 'POL', explorerName: 'Polygonscan', explorerBaseUrl: 'https://polygonscan.com' }],
  [80002, { name: 'Polygon Amoy', nativeSymbol: 'POL', explorerName: 'Polygonscan', explorerBaseUrl: 'https://amoy.polygonscan.com' }]
])

const SUPPORTED_CHAIN_IDS: readonly number[] = [...SUPPORTED_CHAINS.keys()]

/** The chain's entry, or undefined for a chain the page does not know. */
function getSupportedChain(chainId: number | null | undefined): SupportedChain | undefined {
  return chainId ? SUPPORTED_CHAINS.get(chainId) : undefined
}

export { SUPPORTED_CHAIN_IDS, SUPPORTED_CHAINS, getSupportedChain }
export type { SupportedChain }
