import { getSupportedChain } from './chains'

/** Symbol of the chain's native currency (e.g. "POL"), or empty when unsupported. */
function getNativeSymbol(chainId: number | undefined): string {
  return getSupportedChain(chainId)?.nativeSymbol ?? ''
}

/** Human-readable network name for a chain (e.g. "Polygon"), or empty when unsupported. */
function getNetworkName(chainId: number | undefined): string {
  return getSupportedChain(chainId)?.name ?? ''
}

/** Human-readable explorer name for a chain (e.g. "Polygonscan"), or empty when unsupported. */
function getExplorerName(chainId: number | undefined): string {
  return getSupportedChain(chainId)?.explorerName ?? ''
}

/**
 * Builds a block-explorer address URL for the given chain, or null when the chain is
 * unsupported or the address is missing (callers render plain text in that case).
 */
function getExplorerAddressUrl(chainId: number | undefined, address: string | null | undefined): string | null {
  const base = getSupportedChain(chainId)?.explorerBaseUrl
  return base && address ? `${base}/address/${address}` : null
}

export { getExplorerAddressUrl, getExplorerName, getNativeSymbol, getNetworkName }
