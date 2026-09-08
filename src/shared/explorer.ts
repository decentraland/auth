import { ADDRESS_REGEX } from './auth/address'
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
 * Builds a block-explorer address URL for the given chain, or null when the chain is unsupported or the
 * address is missing or not an address (callers render plain text in that case). Only an address goes into
 * a link: every caller passes a value it validated, and this keeps a future one from linking arbitrary text.
 */
function getExplorerAddressUrl(chainId: number | undefined, address: string | null | undefined): string | null {
  const base = getSupportedChain(chainId)?.explorerBaseUrl
  return base && address && ADDRESS_REGEX.test(address) ? `${base}/address/${address}` : null
}

export { getExplorerAddressUrl, getExplorerName, getNativeSymbol, getNetworkName }
