import { ChainId } from '@dcl/schemas/dist/dapps/chain-id'

/** A widely used token Decentraland does not own but lets its marketplaces settle in, on one chain. */
type KnownToken = {
  chainId: number
  /** Lowercased. */
  address: string
  symbol: string
  name: string
}

// The stablecoins a Decentraland marketplace call may hand to a Decentraland contract without the request
// being refused (see verifyCounterparties): USDT and USDC on every chain the review runs on, alongside MANA,
// which the registry already carries. Recognition only: nothing is decoded against them, they never wear the
// Decentraland badge, and the summary names them from this table next to whatever the token says about
// itself. Every address here was checked on chain (symbol, name, decimals) before being listed; Tether
// publishes no official testnet USDT, so the test chains carry USDC only.
const KNOWN_TOKENS: ReadonlyArray<KnownToken> = [
  { chainId: ChainId.ETHEREUM_MAINNET, address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', name: 'Tether USD' },
  { chainId: ChainId.ETHEREUM_MAINNET, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', name: 'USD Coin' },
  { chainId: ChainId.MATIC_MAINNET, address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', symbol: 'USDT', name: 'Tether USD' },
  { chainId: ChainId.MATIC_MAINNET, address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', symbol: 'USDC', name: 'USD Coin' },
  { chainId: ChainId.MATIC_MAINNET, address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC.e', name: 'USD Coin (bridged)' },
  { chainId: ChainId.ETHEREUM_SEPOLIA, address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', symbol: 'USDC', name: 'USD Coin (testnet)' },
  { chainId: ChainId.MATIC_AMOY, address: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582', symbol: 'USDC', name: 'USD Coin (testnet)' }
]

/** The known token at `address` on `chainId`, or null. Case-insensitive on the address. */
function getKnownToken(address: string, chainId: number): KnownToken | null {
  const normalized = address.toLowerCase()
  return KNOWN_TOKENS.find(token => token.chainId === chainId && token.address === normalized) ?? null
}

export { getKnownToken }
export type { KnownToken }
