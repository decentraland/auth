import { getKnownToken } from './knownTokens'

describe('when looking up a known token', () => {
  const POLYGON_USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
  const MAINNET_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

  describe('and the address is a listed stablecoin on that chain, in another casing', () => {
    it('should return its identity', () => {
      expect(getKnownToken(POLYGON_USDT, 137)).toEqual({
        chainId: 137,
        address: POLYGON_USDT.toLowerCase(),
        symbol: 'USDT',
        name: 'Tether USD'
      })
    })
  })

  describe('and the address is a listed stablecoin on another chain only', () => {
    it('should return null, since the same address is another contract there', () => {
      expect(getKnownToken(POLYGON_USDT, 1)).toBeNull()
      expect(getKnownToken(MAINNET_USDC, 137)).toBeNull()
    })
  })

  describe('and the address is not listed', () => {
    it('should return null', () => {
      expect(getKnownToken('0x1234567890abcdef1234567890abcdef12345678', 137)).toBeNull()
    })
  })
})
