import { getPreviewFingerprint } from './previewFingerprint'
import { SimulationResponseBody } from './types'

function buildResult(overrides: Partial<SimulationResponseBody> = {}): SimulationResponseBody {
  return { status: 'success', assetChanges: [], approvalChanges: [], balanceChanges: [], events: [], ...overrides }
}

describe('getPreviewFingerprint', () => {
  describe('when there is no result', () => {
    it('should return an empty fingerprint', () => {
      expect(getPreviewFingerprint(undefined)).toBe('')
    })
  })

  describe('when two results show the same outcome, movements and approvals', () => {
    let first: SimulationResponseBody
    let second: SimulationResponseBody

    beforeEach(() => {
      first = buildResult({ balanceChanges: [{ address: '0xa', dollarValue: '1' }] })
      second = buildResult({ balanceChanges: [{ address: '0xb', dollarValue: '2' }], events: [{ name: 'Transfer', address: '0xc' }] })
    })

    it('should return the same fingerprint because balances and events are not part of the statement', () => {
      expect(getPreviewFingerprint(first)).toBe(getPreviewFingerprint(second))
    })
  })

  describe('when two results differ in an approval', () => {
    let first: SimulationResponseBody
    let second: SimulationResponseBody

    beforeEach(() => {
      const approval = {
        kind: 'approval' as const,
        standard: 'erc20' as const,
        owner: '0xowner',
        spender: '0xspender',
        amount: '100',
        rawAmount: '100000000000000000000',
        isUnlimited: false,
        tokenId: null,
        approved: null,
        contractAddress: '0xmana',
        symbol: 'MANA',
        name: 'MANA'
      }
      first = buildResult({ approvalChanges: [approval] })
      second = buildResult({ approvalChanges: [{ ...approval, spender: '0xattacker' }] })
    })

    it('should return different fingerprints', () => {
      expect(getPreviewFingerprint(first)).not.toBe(getPreviewFingerprint(second))
    })
  })

  describe('when two results differ in outcome only', () => {
    let first: SimulationResponseBody
    let second: SimulationResponseBody

    beforeEach(() => {
      first = buildResult({ status: 'success' })
      second = buildResult({ status: 'reverted' })
    })

    it('should return different fingerprints', () => {
      expect(getPreviewFingerprint(first)).not.toBe(getPreviewFingerprint(second))
    })
  })
})
