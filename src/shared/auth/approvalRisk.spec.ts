import { isApprovalRevocation, isDangerousApproval } from './approvalRisk'
import { ApprovalChange } from './types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SPENDER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

function buildAllowance(overrides: Partial<ApprovalChange> = {}): ApprovalChange {
  return {
    kind: 'approval',
    standard: 'erc20',
    owner: '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd',
    spender: SPENDER,
    amount: '100',
    rawAmount: '100000000000000000000',
    isUnlimited: false,
    tokenId: null,
    approved: null,
    contractAddress: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
    symbol: 'MANA',
    name: 'MANA',
    ...overrides
  }
}

describe('isApprovalRevocation', () => {
  describe.each<[string, Partial<ApprovalChange>]>([
    ['ApprovalForAll is set to false', { kind: 'approvalForAll', standard: 'erc721', amount: null, rawAmount: null, approved: false }],
    [
      'a single token is approved to the zero address',
      { standard: 'erc721', spender: ZERO_ADDRESS, amount: null, rawAmount: null, tokenId: '7' }
    ],
    ['an allowance to the zero address is set to zero', { spender: ZERO_ADDRESS, rawAmount: '0', amount: '0.0' }],
    ['the base-unit allowance is zero', { rawAmount: '0', amount: '0.0' }],
    ['the base-unit allowance is zero even though the display amount is not', { rawAmount: '0', amount: '5' }],
    ['only a display amount is available and it is zero', { rawAmount: null, amount: '0.0' }]
  ])('when %s', (_label, overrides) => {
    it('should return true', () => {
      expect(isApprovalRevocation(buildAllowance(overrides))).toBe(true)
    })
  })

  describe.each<[string, Partial<ApprovalChange>]>([
    ['ApprovalForAll is set to true', { kind: 'approvalForAll', standard: 'erc721', amount: null, rawAmount: null, approved: true }],
    ['a single token is approved to a spender', { standard: 'erc721', amount: null, rawAmount: null, tokenId: '7' }],
    ['a limited allowance is granted', {}],
    ['a non-zero allowance is granted to the zero address, which revokes nobody', { spender: ZERO_ADDRESS }],
    ['the display amount rounds to zero but the base-unit allowance does not', { rawAmount: '1', amount: '0' }],
    ['only a display amount is available and it is tiny but not zero', { rawAmount: null, amount: '0.000000000000000001' }],
    ['no amount is available at all', { rawAmount: null, amount: null }],
    ['the base-unit allowance is an empty string', { rawAmount: '', amount: null }]
  ])('when %s', (_label, overrides) => {
    it('should return false', () => {
      expect(isApprovalRevocation(buildAllowance(overrides))).toBe(false)
    })
  })
})

describe('isDangerousApproval', () => {
  let recognized: (address: string) => boolean
  let unrecognized: (address: string) => boolean

  beforeEach(() => {
    recognized = () => true
    unrecognized = () => false
  })

  describe('when the approval is a revocation', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance({ rawAmount: '0', amount: '0.0' })
    })

    it('should return false even for an unrecognized spender', () => {
      expect(isDangerousApproval(approval, unrecognized)).toBe(false)
    })
  })

  describe('when ApprovalForAll is granted', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance({ kind: 'approvalForAll', standard: 'erc721', amount: null, rawAmount: null, approved: true })
    })

    it('should return true even for a recognized spender', () => {
      expect(isDangerousApproval(approval, recognized)).toBe(true)
    })
  })

  describe('when an unlimited allowance is granted', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance({
        isUnlimited: true,
        amount: null,
        rawAmount: '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      })
    })

    it('should return true even for a recognized spender', () => {
      expect(isDangerousApproval(approval, recognized)).toBe(true)
    })
  })

  describe('when a limited allowance is granted', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance()
    })

    it('should return true for an unrecognized spender', () => {
      expect(isDangerousApproval(approval, unrecognized)).toBe(true)
    })

    it('should return false for a recognized spender', () => {
      expect(isDangerousApproval(approval, recognized)).toBe(false)
    })
  })

  describe('when a tiny allowance is displayed as zero', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance({ rawAmount: '1', amount: '0' })
    })

    it('should still return true for an unrecognized spender because the base units say it is a grant', () => {
      expect(isDangerousApproval(approval, unrecognized)).toBe(true)
    })
  })

  describe('when a single token is approved', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance({ standard: 'erc721', amount: null, rawAmount: null, tokenId: '7' })
    })

    it('should return true for an unrecognized spender', () => {
      expect(isDangerousApproval(approval, unrecognized)).toBe(true)
    })

    it('should return false for a recognized spender', () => {
      expect(isDangerousApproval(approval, recognized)).toBe(false)
    })
  })

  describe('when a single token approval is cleared with the zero address', () => {
    let approval: ApprovalChange

    beforeEach(() => {
      approval = buildAllowance({ standard: 'erc721', spender: ZERO_ADDRESS, amount: null, rawAmount: null, tokenId: '7' })
    })

    it('should return false because it is a revocation', () => {
      expect(isDangerousApproval(approval, unrecognized)).toBe(false)
    })
  })
})
