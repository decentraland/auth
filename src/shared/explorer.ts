// Block explorer base URLs by chain id, for linking addresses shown in the UI.
const EXPLORER_BASE_URLS = new Map<number, string>([
  [1, 'https://etherscan.io'],
  [11155111, 'https://sepolia.etherscan.io'],
  [137, 'https://polygonscan.com'],
  [80002, 'https://amoy.polygonscan.com']
])

const EXPLORER_NAMES = new Map<number, string>([
  [1, 'Etherscan'],
  [11155111, 'Etherscan'],
  [137, 'Polygonscan'],
  [80002, 'Polygonscan']
])

const NETWORK_NAMES = new Map<number, string>([
  [1, 'Ethereum'],
  [11155111, 'Ethereum Sepolia'],
  [137, 'Polygon'],
  [80002, 'Polygon Amoy']
])

/** Human-readable network name for a chain (e.g. "Polygon"), or empty when unsupported. */
function getNetworkName(chainId: number | undefined): string {
  return chainId ? (NETWORK_NAMES.get(chainId) ?? '') : ''
}

/** Human-readable explorer name for a chain (e.g. "Polygonscan"), or empty when unsupported. */
function getExplorerName(chainId: number | undefined): string {
  return chainId ? (EXPLORER_NAMES.get(chainId) ?? '') : ''
}

/**
 * Builds a block-explorer address URL for the given chain, or null when the chain is
 * unsupported or the address is missing (callers render plain text in that case).
 */
function getExplorerAddressUrl(chainId: number | undefined, address: string | null | undefined): string | null {
  if (!chainId || !address) return null
  const base = EXPLORER_BASE_URLS.get(chainId)
  return base ? `${base}/address/${address}` : null
}

export { getExplorerAddressUrl, getExplorerName, getNetworkName }
