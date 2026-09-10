import { parseSimulationResponse } from './simulationResponse'
import { ApprovalChange, AssetChange, SimulationResponseBody } from './types'

function buildAssetChange(overrides: Partial<AssetChange> = {}): AssetChange {
  return {
    type: 'transfer',
    standard: 'erc20',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    amount: '1.5',
    rawAmount: '1500000000000000000',
    tokenId: null,
    contractAddress: '0x3333333333333333333333333333333333333333',
    symbol: 'MANA',
    name: 'Decentraland MANA',
    decimals: 18,
    logoUrl: null,
    dollarValue: '1.50',
    ...overrides
  }
}

function buildApprovalChange(overrides: Partial<ApprovalChange> = {}): ApprovalChange {
  return {
    kind: 'approval',
    standard: 'erc20',
    owner: '0x1111111111111111111111111111111111111111',
    spender: '0x4444444444444444444444444444444444444444',
    amount: '100',
    rawAmount: '100000000000000000000',
    isUnlimited: false,
    tokenId: null,
    approved: null,
    contractAddress: '0x3333333333333333333333333333333333333333',
    symbol: 'MANA',
    name: 'Decentraland MANA',
    ...overrides
  }
}

function buildResponse(overrides: Partial<SimulationResponseBody> = {}): SimulationResponseBody {
  return {
    status: 'success',
    assetChanges: [buildAssetChange()],
    approvalChanges: [buildApprovalChange()],
    balanceChanges: [{ address: '0x1111111111111111111111111111111111111111', dollarValue: '-1.50' }],
    events: [{ name: 'Transfer', address: '0x3333333333333333333333333333333333333333' }],
    eventsTruncated: false,
    ...overrides
  }
}

describe('parseSimulationResponse', () => {
  describe('when the body is a complete summary', () => {
    it('should return it unchanged', () => {
      const response = buildResponse()

      expect(parseSimulationResponse(response)).toEqual(response)
    })
  })

  describe('when the body is a revert carrying a reason', () => {
    it('should return it unchanged', () => {
      const response = buildResponse({
        status: 'reverted',
        error: 'ERC20: insufficient allowance',
        assetChanges: [],
        approvalChanges: []
      })

      expect(parseSimulationResponse(response)).toEqual(response)
    })
  })

  describe('when the body omits the truncation flag, as a server from before it does', () => {
    it('should accept it and leave the flag absent, since silence is not a promise the events are complete', () => {
      const response = buildResponse()
      delete response.eventsTruncated

      const parsed = parseSimulationResponse(response)

      expect(parsed).not.toBeNull()
      expect(parsed?.eventsTruncated).toBeUndefined()
    })
  })

  describe.each([
    ['not an object', null],
    ['an array', []],
    ['a string', 'success'],
    ['missing the status', { ...buildResponse(), status: undefined }],
    ['carrying a status this client does not declare', { ...buildResponse(), status: 'pending' }],
    ['carrying a revert reason that is not text', { ...buildResponse(), status: 'reverted', error: 404 }],
    ['carrying a truncation flag that is not a boolean', { ...buildResponse(), eventsTruncated: 'yes' }]
  ])('when the body is %s', (_label, value) => {
    it('should return null', () => {
      expect(parseSimulationResponse(value)).toBeNull()
    })
  })

  describe.each([['assetChanges'], ['approvalChanges'], ['balanceChanges'], ['events']])(
    'when the body has no %s collection',
    collection => {
      it('should return null rather than let a consumer read a missing collection as an empty one', () => {
        const response: Record<string, unknown> = { ...buildResponse() }
        delete response[collection]

        expect(parseSimulationResponse(response)).toBeNull()
      })
    }
  )

  describe.each([['assetChanges'], ['approvalChanges'], ['balanceChanges'], ['events']])(
    'when the %s collection is not an array',
    collection => {
      it('should return null', () => {
        expect(parseSimulationResponse({ ...buildResponse(), [collection]: {} })).toBeNull()
      })
    }
  )

  describe('when an approval row is an empty object', () => {
    it('should return null, since the approval gate dereferences its fields to decide whether to warn', () => {
      expect(parseSimulationResponse({ ...buildResponse(), approvalChanges: [{}] })).toBeNull()
    })
  })

  describe.each([
    ['a kind it does not declare', buildApprovalChange({ kind: 'permit' as unknown as ApprovalChange['kind'] })],
    ['a standard it does not declare', buildApprovalChange({ standard: 'erc1155' as unknown as ApprovalChange['standard'] })],
    ['no owner', { ...buildApprovalChange(), owner: undefined }],
    ['no spender', { ...buildApprovalChange(), spender: undefined }],
    ['no contract address', { ...buildApprovalChange(), contractAddress: undefined }],
    ['an unlimited flag that is not a boolean', { ...buildApprovalChange(), isUnlimited: 'true' }],
    ['an approved flag that is neither a boolean nor null', { ...buildApprovalChange(), approved: 1 }],
    ['a raw amount that is absent rather than null', { ...buildApprovalChange(), rawAmount: undefined }]
  ])('when an approval row carries %s', (_label, approval) => {
    it('should return null', () => {
      expect(parseSimulationResponse({ ...buildResponse(), approvalChanges: [approval] })).toBeNull()
    })
  })

  describe.each([
    ['a type it does not declare', buildAssetChange({ type: 'swap' as unknown as AssetChange['type'] })],
    ['a standard it does not declare', buildAssetChange({ standard: 'erc777' as unknown as AssetChange['standard'] })],
    ['a from that is absent rather than null', { ...buildAssetChange(), from: undefined }],
    ['decimals that are not a number', { ...buildAssetChange(), decimals: '18' }],
    ['an amount that is not a string', { ...buildAssetChange(), amount: 1.5 }]
  ])('when an asset row carries %s', (_label, change) => {
    it('should return null', () => {
      expect(parseSimulationResponse({ ...buildResponse(), assetChanges: [change] })).toBeNull()
    })
  })

  describe('when a balance row has no address', () => {
    it('should return null, since the net-change line matches rows by address', () => {
      expect(parseSimulationResponse({ ...buildResponse(), balanceChanges: [{ dollarValue: '1' }] })).toBeNull()
    })
  })

  describe('when an event row has no address', () => {
    it('should return null, since the branded views judge events by their emitting contract', () => {
      expect(parseSimulationResponse({ ...buildResponse(), events: [{ name: 'Transfer' }] })).toBeNull()
    })
  })
})
