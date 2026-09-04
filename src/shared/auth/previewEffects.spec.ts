import { hasNoVisibleEffects } from './previewEffects'
import { AssetChange, SimulationResponseBody } from './types'

const USER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const OTHER = '0x1234567890abcdef1234567890abcdef12345678'
const THIRD = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

function buildTransfer(from: string, to: string): AssetChange {
  return {
    type: 'transfer',
    standard: 'erc20',
    from,
    to,
    amount: '5',
    rawAmount: '5000000000000000000',
    tokenId: null,
    contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
    symbol: 'MANA',
    name: 'MANA',
    decimals: 18,
    logoUrl: null,
    dollarValue: null
  }
}

function buildResult(overrides: Partial<SimulationResponseBody> = {}): SimulationResponseBody {
  return { status: 'success', assetChanges: [], approvalChanges: [], balanceChanges: [], events: [], ...overrides }
}

describe('hasNoVisibleEffects', () => {
  describe('when the preview has no asset or permission changes', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult()
    })

    it('should return true', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(true)
    })
  })

  describe('when the preview only decoded events', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({ events: [{ name: 'UpdateOperator', address: OTHER }] })
    })

    it('should return true because events are not something the user can check', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(true)
    })
  })

  describe('when the only movements are between third parties', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({ assetChanges: [buildTransfer(THIRD, OTHER)] })
    })

    it('should return true because the summary does not show them', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(true)
    })
  })

  describe('when the user sends an asset', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({ assetChanges: [buildTransfer(USER, OTHER)] })
    })

    it('should return false', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(false)
    })
  })

  describe('when the user receives an asset', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({ assetChanges: [buildTransfer(OTHER, USER)] })
    })

    it('should return false', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(false)
    })
  })

  describe('when the user address only differs from the preview in casing', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({ assetChanges: [buildTransfer(USER, OTHER)] })
    })

    it('should still recognize the user as a party', () => {
      expect(hasNoVisibleEffects(result, USER.toUpperCase())).toBe(false)
    })
  })

  describe('when a permission changes', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({
        approvalChanges: [
          {
            kind: 'approvalForAll',
            standard: 'erc721',
            owner: USER,
            spender: OTHER,
            amount: null,
            rawAmount: null,
            isUnlimited: false,
            tokenId: null,
            approved: true,
            contractAddress: THIRD,
            symbol: null,
            name: null
          }
        ]
      })
    })

    it('should return false', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(false)
    })
  })

  describe('when the preview reverted with nothing to show', () => {
    let result: SimulationResponseBody

    beforeEach(() => {
      result = buildResult({ status: 'reverted', error: 'Not allowed' })
    })

    it('should return false because the revert is its own signal', () => {
      expect(hasNoVisibleEffects(result, USER)).toBe(false)
    })
  })
})
