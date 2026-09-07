import { hashTypedData } from 'viem'
import { MalformedSignatureRequestError } from './errors'
import { assertSignatureParamsAreCanonical } from './signMethodGuard'
import { TypedDataReviewNode, resolveTypedDataReview } from './typedDataReview'

type Payload = {
  primaryType: string
  types: Record<string, { name: string; type: string }[]>
  domain: Record<string, unknown>
  message: Record<string, unknown>
}

type SignedByDapp = {
  payload: Payload
  // Fields whose rendering the payload exercises, addressed by their path in the review.
  shown: { path: string[]; value: string }[]
}

const nodeAt = (fields: TypedDataReviewNode[], path: string[]): TypedDataReviewNode | undefined => {
  let nodes: TypedDataReviewNode[] | undefined = fields
  let node: TypedDataReviewNode | undefined
  for (const name of path) {
    node = nodes?.find(candidate => candidate.name === name)
    nodes = node?.children
  }
  return node
}

const DAPP_USER = '0x1234567890abcdef1234567890abcdef12345678'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MANA_POLYGON = '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4'
const POLYGON_SALT = `0x${'00'.repeat(31)}89`

/* eslint-disable @typescript-eslint/naming-convention */
// The typed data Decentraland's own dApps ask a wallet to sign, as the JSON-RPC param carries it. The
// marketplace Trade and the rentals Listing come out of ethers v5's JsonRpcSigner._signTypedData, which
// declares EIP712Domain, keeps only the declared keys, writes integers as decimal strings (the rentals'
// 32-byte chainId included), lowercases addresses and hexlifies bytes. The builder's ConsumeSlots cheque is
// built by hand, with a numeric qty and a checksummed verifying contract.
const SIGNED_BY_DAPPS: Record<string, SignedByDapp> = {
  'off-chain marketplace Trade': {
    payload: {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'verifyingContract', type: 'address' },
          { name: 'salt', type: 'bytes32' }
        ],
        Trade: [
          { name: 'checks', type: 'Checks' },
          { name: 'sent', type: 'AssetWithoutBeneficiary[]' },
          { name: 'received', type: 'Asset[]' }
        ],
        Asset: [
          { name: 'assetType', type: 'uint256' },
          { name: 'contractAddress', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'extra', type: 'bytes' },
          { name: 'beneficiary', type: 'address' }
        ],
        AssetWithoutBeneficiary: [
          { name: 'assetType', type: 'uint256' },
          { name: 'contractAddress', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'extra', type: 'bytes' }
        ],
        Checks: [
          { name: 'uses', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'effective', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
          { name: 'contractSignatureIndex', type: 'uint256' },
          { name: 'signerSignatureIndex', type: 'uint256' },
          { name: 'allowedRoot', type: 'bytes32' },
          { name: 'externalChecks', type: 'ExternalCheck[]' }
        ],
        ExternalCheck: [
          { name: 'contractAddress', type: 'address' },
          { name: 'selector', type: 'bytes4' },
          { name: 'value', type: 'bytes' },
          { name: 'required', type: 'bool' }
        ]
      },
      domain: {
        name: 'DecentralandMarketplacePolygon',
        version: '1.0.0',
        verifyingContract: '0xa40b1d129b8906888720686f3a01921ddf37716f',
        salt: POLYGON_SALT
      },
      primaryType: 'Trade',
      message: {
        checks: {
          uses: '1',
          expiration: '1767225600',
          effective: '1764547200',
          salt: `0x${'ab'.repeat(32)}`,
          contractSignatureIndex: '0',
          signerSignatureIndex: '0',
          allowedRoot: `0x${'00'.repeat(32)}`,
          externalChecks: [
            { contractAddress: '0x3c2b9b4bd4f8f9a1c0d2e3f4a5b6c7d8e9f0a1b2', selector: '0x70a08231', value: '0x', required: true }
          ]
        },
        sent: [
          {
            assetType: '3',
            contractAddress: '0x3c2b9b4bd4f8f9a1c0d2e3f4a5b6c7d8e9f0a1b2',
            value: '210624583337114373395836055367340864637790190801098222508621955073',
            extra: '0x'
          }
        ],
        received: [{ assetType: '1', contractAddress: MANA_POLYGON, value: '1000000000000000000', extra: '0x', beneficiary: DAPP_USER }]
      }
    },
    shown: [
      { path: ['checks', 'externalChecks', '[0]', 'selector'], value: '0x70a08231' },
      { path: ['checks', 'externalChecks', '[0]', 'value'], value: '0x' },
      { path: ['checks', 'externalChecks', '[0]', 'required'], value: 'true' },
      { path: ['sent', '[0]', 'value'], value: '210624583337114373395836055367340864637790190801098222508621955073' },
      { path: ['received', '[0]', 'beneficiary'], value: DAPP_USER }
    ]
  },
  'rentals Listing': {
    payload: {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Listing: [
          { name: 'signer', type: 'address' },
          { name: 'contractAddress', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'indexes', type: 'uint256[3]' },
          { name: 'pricePerDay', type: 'uint256[]' },
          { name: 'maxDays', type: 'uint256[]' },
          { name: 'minDays', type: 'uint256[]' },
          { name: 'target', type: 'address' }
        ]
      },
      domain: { name: 'Rentals', version: '1', chainId: '1', verifyingContract: '0x3a1469499d0be105d4f77045ca403a5f6dc2f3f5' },
      primaryType: 'Listing',
      message: {
        signer: DAPP_USER,
        contractAddress: '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d',
        tokenId: '3402823669209384634633746074317682114580',
        expiration: '1767225600',
        indexes: ['0', '3', '1'],
        pricePerDay: ['1000000000000000000', '5000000000000000000'],
        maxDays: ['7', '30'],
        minDays: ['1', '7'],
        target: ZERO_ADDRESS
      }
    },
    shown: [
      { path: ['tokenId'], value: '3402823669209384634633746074317682114580' },
      { path: ['indexes', '[2]'], value: '1' },
      { path: ['pricePerDay', '[1]'], value: '5000000000000000000' },
      { path: ['target'], value: ZERO_ADDRESS }
    ]
  },
  'builder ConsumeSlots cheque': {
    payload: {
      domain: {
        name: 'Decentraland Third Party Registry',
        verifyingContract: '0x1C436C1EFb4608dFfDC8bace99d2B03c314f3348',
        version: '1',
        salt: POLYGON_SALT
      },
      message: { thirdPartyId: 'urn:decentraland:matic:collections-thirdparty:cryptohats', qty: 10, salt: `0x${'5f'.repeat(32)}` },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'verifyingContract', type: 'address' },
          { name: 'salt', type: 'bytes32' }
        ],
        ConsumeSlots: [
          { name: 'thirdPartyId', type: 'string' },
          { name: 'qty', type: 'uint256' },
          { name: 'salt', type: 'bytes32' }
        ]
      },
      primaryType: 'ConsumeSlots'
    },
    shown: [
      { path: ['thirdPartyId'], value: 'urn:decentraland:matic:collections-thirdparty:cryptohats' },
      { path: ['qty'], value: '10' },
      { path: ['salt'], value: `0x${'5f'.repeat(32)}` }
    ]
  }
}
/* eslint-enable @typescript-eslint/naming-convention */

describe('when reviewing generic typed data', () => {
  let payload: Payload
  let signer: string
  let method: string

  beforeEach(() => {
    signer = '0x1234567890abcdef1234567890abcdef12345678'
    method = 'eth_signTypedData_v4'
    payload = {
      primaryType: 'Permit',
      types: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Permit: [
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      },
      domain: { name: 'Token', version: '1', chainId: 137, verifyingContract: signer },
      message: { spender: signer, value: '1000', nonce: 0, deadline: '2000000000' }
    }
  })

  it('should preserve the digest of valid signed data', () => {
    expect(resolveTypedDataReview(payload, method).hash).toBe(hashTypedData(payload as Parameters<typeof hashTypedData>[0]))
  })

  describe('and the request is immutable', () => {
    beforeEach(() => {
      Object.freeze(payload.message)
      Object.freeze(payload.domain)
      Object.freeze(payload.types)
      Object.freeze(payload)
    })

    it('should review it without rewriting the signed payload', () => {
      expect(() => resolveTypedDataReview(payload, method)).not.toThrow()
    })
  })

  describe('and message properties arrive in a different order', () => {
    beforeEach(() => {
      payload.message = { deadline: '2000000000', nonce: 0, value: '0x3e8', spender: signer }
    })

    it('should present declared field order and exact decimal integers', () => {
      expect(resolveTypedDataReview(payload, method).fields).toEqual([
        { name: 'spender', type: 'address', value: signer },
        { name: 'value', type: 'uint256', value: '1000' },
        { name: 'nonce', type: 'uint256', value: '0' },
        { name: 'deadline', type: 'uint256', value: '2000000000' }
      ])
    })
  })

  describe.each([
    'extra message field',
    'missing message field',
    'duplicate field',
    'missing type',
    'undefined reference',
    'unsigned domain field',
    'duplicate domain field',
    'missing domain field',
    'unknown domain field',
    'wrong domain type',
    'derived unsigned chain',
    'unsafe integer',
    'out of range integer'
  ])('and the payload has this problem: %s', problem => {
    beforeEach(() => {
      switch (problem) {
        case 'extra message field':
          payload.message.description = 'Additional description'
          break
        case 'missing message field':
          delete payload.message.value
          break
        case 'duplicate field':
          payload.types.Permit.push({ name: 'value', type: 'uint256' })
          break
        case 'missing type':
          delete payload.types.Permit
          break
        case 'undefined reference':
          payload.types.Permit[1].type = 'Unknown[]'
          payload.message.value = []
          break
        case 'unsigned domain field':
          payload.types.EIP712Domain = [{ name: 'name', type: 'string' }]
          break
        case 'duplicate domain field':
          payload.domain = { name: 'Token', version: '1' }
          payload.types.EIP712Domain = [
            { name: 'name', type: 'string' },
            { name: 'name', type: 'string' }
          ]
          break
        case 'missing domain field':
          payload.domain = {}
          payload.types.EIP712Domain = [{ name: 'chainId', type: 'uint256' }]
          break
        case 'unknown domain field':
          payload.domain.description = 'Additional description'
          break
        case 'wrong domain type':
          payload.domain = { chainId: 137 }
          payload.types.EIP712Domain = [{ name: 'chainId', type: 'uint8' }]
          break
        case 'derived unsigned chain':
          payload.domain.chainId = '137'
          break
        case 'unsafe integer':
          payload.message.value = Number.MAX_SAFE_INTEGER + 1
          break
        case 'out of range integer':
          payload.message.value = (1n << 256n).toString()
          break
      }
    })

    it('should reject the payload', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow(MalformedSignatureRequestError)
    })

    it('should not turn the request away at recover, where an external wallet would show the payload itself', () => {
      expect(() => assertSignatureParamsAreCanonical(method, [signer, JSON.stringify(payload)], signer)).not.toThrow()
    })
  })

  describe('and the types carry a malformed struct the primary type never reaches', () => {
    beforeEach(() => {
      payload.types.Unused = [
        { name: 'a', type: 'uint256' },
        { name: 'a', type: 'uint256' }
      ]
    })

    it('should ignore it because it is not signed', () => {
      expect(() => resolveTypedDataReview(payload, method)).not.toThrow()
    })
  })

  describe('and an unreached struct uses an array under eth_signTypedData_v3', () => {
    beforeEach(() => {
      method = 'eth_signTypedData_v3'
      payload.types.Unused = [{ name: 'items', type: 'uint256[]' }]
    })

    it('should not reject a signature that never reaches the array', () => {
      expect(() => resolveTypedDataReview(payload, method)).not.toThrow()
    })
  })

  describe('and a reached struct is named like a built-in type', () => {
    beforeEach(() => {
      payload.types.address = [{ name: 'inner', type: 'uint256' }]
      payload.message.spender = { inner: '1' }
    })

    it('should reject the payload because encoders disagree on what such a field is', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow('shadows a built-in type')
    })
  })

  describe('and a signed string carries characters that would reorder or hide their neighbours', () => {
    beforeEach(() => {
      payload.types.Permit.push({ name: 'memo', type: 'string' })
      payload.message.memo = 'Send 1 MANA to \u202e0xattacker'
    })

    it('should show them as visible escapes instead of letting them act on the display', () => {
      const memo = resolveTypedDataReview(payload, method).fields.find(field => field.name === 'memo')
      expect(memo?.value).toBe('Send 1 MANA to \\u{202e}0xattacker')
    })

    it('should leave the signed digest untouched', () => {
      expect(resolveTypedDataReview(payload, method).hash).toBe(hashTypedData(payload as Parameters<typeof hashTypedData>[0]))
    })
  })

  describe('and the domain schema is explicit', () => {
    beforeEach(() => {
      payload.domain = { chainId: '137', salt: `0x${'00'.repeat(32)}`, version: '1' }
      payload.types.EIP712Domain = [
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'salt', type: 'bytes32' }
      ]
    })

    it('should accept all standard domain fields with their signed types', () => {
      expect(() => resolveTypedDataReview(payload, method)).not.toThrow()
    })
  })

  describe('and the message contains nested arrays of structs', () => {
    beforeEach(() => {
      payload.primaryType = 'Order'
      payload.types = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Order: [{ name: 'items', type: 'Item[][1]' }],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Item: [{ name: 'amount', type: 'uint256' }]
      }
      payload.message = { items: [[{ amount: '10' }, { amount: '20' }]] }
    })

    it('should preserve each dimension and array index', () => {
      expect(resolveTypedDataReview(payload, method).fields).toEqual([
        {
          name: 'items',
          type: 'Item[][1]',
          children: [
            {
              name: '[0]',
              type: 'Item[]',
              children: [
                { name: '[0]', type: 'Item', children: [{ name: 'amount', type: 'uint256', value: '10' }] },
                { name: '[1]', type: 'Item', children: [{ name: 'amount', type: 'uint256', value: '20' }] }
              ]
            }
          ]
        }
      ])
    })

    describe.each(['extra nested field', 'missing nested field', 'null struct', 'wrong fixed length', 'wrong array shape', 'v3 arrays'])(
      'and the payload has this problem: %s',
      problem => {
        beforeEach(() => {
          switch (problem) {
            case 'extra nested field':
              payload.message.items = [[{ amount: '10', description: 'Additional description' }]]
              break
            case 'missing nested field':
              payload.message.items = [[{}]]
              break
            case 'null struct':
              payload.message.items = [[null]]
              break
            case 'wrong fixed length':
              payload.message.items = []
              break
            case 'wrong array shape':
              payload.message.items = { amount: '10' }
              break
            case 'v3 arrays':
              method = 'eth_signTypedData_v3'
              break
          }
        })

        it('should reject the request', () => {
          expect(() => resolveTypedDataReview(payload, method)).toThrow(MalformedSignatureRequestError)
        })
      }
    )
  })

  describe.each(['bool', 'string', 'bytes2', 'int8'])('and the signed field has type %s', type => {
    beforeEach(() => {
      payload.types.Permit = [{ name: 'value', type }]
      payload.message = { value: type === 'bool' ? false : type === 'string' ? 'Text' : type === 'bytes2' ? '0xabcd' : -128 }
    })

    it('should accept the exact scalar value', () => {
      expect(() => resolveTypedDataReview(payload, method)).not.toThrow()
    })

    describe('and the value requires a coercion or exceeds its type', () => {
      beforeEach(() => {
        payload.message.value = type === 'bool' ? 'false' : type === 'string' ? 123 : type === 'bytes2' ? '0xab' : -129
      })

      it('should reject the request', () => {
        expect(() => resolveTypedDataReview(payload, method)).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('and a recursive message exceeds the review depth', () => {
    beforeEach(() => {
      payload.primaryType = 'Node'
      // eslint-disable-next-line @typescript-eslint/naming-convention
      payload.types = { Node: [{ name: 'children', type: 'Node[]' }] }
      payload.message = { children: [] }
      for (let depth = 0; depth < 40; depth++) payload.message = { children: [payload.message] }
    })

    it('should reject with a typed error instead of overflowing the stack', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe.each(Object.entries(SIGNED_BY_DAPPS))('and the payload is the %s a Decentraland dApp signs', (_, signed) => {
    let shown: SignedByDapp['shown']

    beforeEach(() => {
      signer = DAPP_USER
      // Parsed from the JSON-RPC param, as the request page receives it.
      payload = JSON.parse(JSON.stringify(signed.payload))
      shown = signed.shown
    })

    it('should accept the request as the wallet library sends it', () => {
      expect(() => assertSignatureParamsAreCanonical(method, [signer, JSON.stringify(payload)], signer)).not.toThrow()
      expect(() => resolveTypedDataReview(payload, method)).not.toThrow()
    })

    it('should preserve its digest and review every field the primary type declares', () => {
      const review = resolveTypedDataReview(payload, method)
      expect(review.hash).toBe(hashTypedData(payload as Parameters<typeof hashTypedData>[0]))
      expect(review.primaryType).toBe(payload.primaryType)
      expect(review.fields.map(field => [field.name, field.type])).toEqual(
        payload.types[payload.primaryType].map(field => [field.name, field.type])
      )
    })

    it('should show the values the dApp signed', () => {
      const { fields } = resolveTypedDataReview(payload, method)
      for (const { path, value } of shown) {
        expect(nodeAt(fields, path)?.value).toBe(value)
      }
    })
  })
})
