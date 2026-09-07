import { hashTypedData } from 'viem'
import { DAPP_USER, SIGNED_BY_DAPPS, SignedByDapp } from './__fixtures__/decentralandTypedData'
import { MalformedSignatureRequestError } from './errors'
import { assertSignatureParamsAreCanonical } from './signMethodGuard'
import { MAX_SCALAR_LENGTH, MAX_TOTAL_LENGTH, TypedDataReviewNode, resolveTypedDataReview } from './typedDataReview'

type Payload = {
  primaryType: string
  types: Record<string, { name: string; type: string }[]>
  domain: Record<string, unknown>
  message: Record<string, unknown>
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
    'reordered domain type',
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
        case 'reordered domain type':
          payload.types.EIP712Domain = [
            { name: 'chainId', type: 'uint256' },
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'verifyingContract', type: 'address' }
          ]
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

  describe('and the domain name and version carry characters that would reorder or hide their neighbours', () => {
    beforeEach(() => {
      payload.domain.name = 'Decentraland\u202e Marketplace'
      payload.domain.version = '1\u200b'
    })

    it('should show them as visible escapes, as it does for message strings', () => {
      const { domain } = resolveTypedDataReview(payload, method)
      expect(domain.name).toBe('Decentraland\\u{202e} Marketplace')
      expect(domain.version).toBe('1\\u{200b}')
    })

    it('should leave the signed digest untouched', () => {
      expect(resolveTypedDataReview(payload, method).hash).toBe(hashTypedData(payload as Parameters<typeof hashTypedData>[0]))
    })
  })

  describe('and the domain chainId is signed as a hex quantity', () => {
    beforeEach(() => {
      payload.domain.chainId = '0x89'
      payload.types.EIP712Domain = [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ]
    })

    it('should present the domain chainId as the exact decimal it signs', () => {
      expect(resolveTypedDataReview(payload, method).domain).toEqual({
        name: 'Token',
        version: '1',
        chainId: '137',
        verifyingContract: signer
      })
    })
  })

  describe('and the domain type is declared in the order EIP-712 defines', () => {
    let derivedOnly: Payload

    beforeEach(() => {
      derivedOnly = { ...payload, types: { ...payload.types } }
      payload.types.EIP712Domain = [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ]
    })

    it('should sign the same digest as the declaration every encoder derives', () => {
      expect(resolveTypedDataReview(payload, method).hash).toBe(hashTypedData(derivedOnly as Parameters<typeof hashTypedData>[0]))
    })
  })

  describe.each(['-0x1', '1e3', ' 1', '1.0', '0x'])('and an integer is written as %s', written => {
    beforeEach(() => {
      payload.message.value = written
    })

    it('should reject the request with the typed error, not a parsing error', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow(MalformedSignatureRequestError)
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

  describe.each([
    ['string', 'a'.repeat(MAX_SCALAR_LENGTH + 1)],
    ['bytes', `0x${'00'.repeat(MAX_SCALAR_LENGTH / 2)}`]
  ])('and a signed %s value is longer than a person could be asked to read', (type, value) => {
    beforeEach(() => {
      payload.types.Permit.push({ name: 'blob', type })
      payload.message.blob = value
    })

    it('should reject the request before escaping, rendering or hashing it', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow('too long to review')
    })
  })

  describe('and the signed values together exceed what the review holds', () => {
    beforeEach(() => {
      payload.types.Permit.push({ name: 'notes', type: 'string[]' })
      payload.message.notes = Array.from({ length: Math.ceil(MAX_TOTAL_LENGTH / MAX_SCALAR_LENGTH) + 1 }, () =>
        'a'.repeat(MAX_SCALAR_LENGTH)
      )
    })

    it('should reject the request', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow('too large to review')
    })
  })

  describe('and a signed string is short but full of characters that are shown as escapes', () => {
    beforeEach(() => {
      payload.types.Permit.push({ name: 'blob', type: 'string' })
      // Eight characters of escape per character: over the cap once shown, well under it as signed.
      payload.message.blob = '\u202e'.repeat(MAX_SCALAR_LENGTH / 8 + 1)
    })

    it('should reject the request by what it would show, not by what was signed', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow('too long to review')
    })
  })

  describe('and the signed strings are short but together fill the review once shown as escapes', () => {
    beforeEach(() => {
      payload.types.Permit.push({ name: 'notes', type: 'string[]' })
      const shownLength = MAX_SCALAR_LENGTH - 8
      payload.message.notes = Array.from({ length: Math.ceil(MAX_TOTAL_LENGTH / shownLength) + 1 }, () => '\u202e'.repeat(shownLength / 8))
    })

    it('should reject the request', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow('too large to review')
    })
  })

  describe('and a long struct name is repeated across an array of small values', () => {
    beforeEach(() => {
      // One declaration within the caps, shown again in the label of every element.
      const longName = 'Struct'.padEnd(MAX_SCALAR_LENGTH, 'x')
      payload.types.Permit.push({ name: 'items', type: `${longName}[]` })
      payload.types[longName] = [{ name: 'amount', type: 'uint8' }]
      payload.message.items = Array.from({ length: Math.ceil(MAX_TOTAL_LENGTH / MAX_SCALAR_LENGTH) + 1 }, () => ({ amount: 1 }))
    })

    it('should reject the request by what the tree would render, not by the declaration alone', () => {
      expect(() => resolveTypedDataReview(payload, method)).toThrow('too large to review')
    })
  })

  describe('and a signed string is long but within what a person could read', () => {
    beforeEach(() => {
      payload.types.Permit.push({ name: 'terms', type: 'string' })
      payload.message.terms = 'terms '.repeat(2000)
    })

    it('should review it in full', () => {
      expect(resolveTypedDataReview(payload, method).fields.find(field => field.name === 'terms')?.value).toBe('terms '.repeat(2000))
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
