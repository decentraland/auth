import { buildTransactionParams, getUnsupportedCalldataAlias } from './transactionParams'

describe('buildTransactionParams', () => {
  describe('when the request carries only the reviewed fields', () => {
    it('should keep them and drop from', () => {
      const params = [{ from: '0xabc', to: '0xdef', value: '0x1', data: '0xdead' }]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0xdead', value: '0x1' }])
    })
  })

  describe('when the request carries extra fee, gas or nonce fields', () => {
    it('should keep only to, data and value', () => {
      const params = [{ to: '0xdef', data: '0x', value: '0x0', maxFeePerGas: '0xffffffffff', gas: '0x5208', nonce: '0x1' }]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })

    it.each([
      'from',
      'gas',
      'gasLimit',
      'gasPrice',
      'maxFeePerGas',
      'maxPriorityFeePerGas',
      'maxFeePerBlobGas',
      'nonce',
      'type',
      'chainId',
      'accessList',
      'blobVersionedHashes'
    ])('should drop %s so it never reaches the wallet', field => {
      const params = [{ to: '0xdef', data: '0x', value: '0x0', [field]: '0xdeadbeef' }]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })

    it('should drop inflated EIP-1559 fee values so the wallet sets the network fee', () => {
      const params = [
        { to: '0xdef', data: '0x', value: '0x0', gas: '0x5208', maxFeePerGas: '42857142857142', maxPriorityFeePerGas: '42857142857142' }
      ]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })
  })

  describe('when the request carries calldata outside the data field', () => {
    it.each(['input', 'extraCallData'])('should reject %s instead of silently dropping it', field => {
      const params = [{ to: '0xdef', data: '0x', value: '0x0', [field]: '0xa9059cbb' }]

      expect(() => buildTransactionParams(params)).toThrow(field)
    })
  })

  describe('when data and value are missing', () => {
    it('should default them', () => {
      expect(buildTransactionParams([{ to: '0xdef' }])).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })
  })

  describe('when the params are not a usable transaction object', () => {
    it('should name the type when the caller serialised the payload', () => {
      expect(() => buildTransactionParams([JSON.stringify({ to: '0xdef' })])).toThrow(/received string/)
    })

    it.each([
      ['a missing params list', undefined],
      ['an empty params list', []],
      ['a null transaction object', [null]],
      ['an array in place of the object', [['0xdef']]]
    ])('should throw for %s', (_label, value) => {
      expect(() => buildTransactionParams(value as unknown[] | undefined)).toThrow(/must be an object/)
    })
  })

  describe('when the transaction has no usable to address', () => {
    it('should say the address is missing rather than blaming the shape', () => {
      expect(() => buildTransactionParams([{ data: '0x' }])).toThrow(/missing a "to" address/)
    })

    it('should reject a non-string to instead of failing later on it', () => {
      expect(() => buildTransactionParams([{ to: 42 }])).toThrow(/missing a "to" address/)
    })
  })
})

describe('getUnsupportedCalldataAlias', () => {
  it.each(['input', 'extraCallData'])('should return %s when present', field => {
    expect(getUnsupportedCalldataAlias({ to: '0xdef', [field]: '0x' })).toBe(field)
  })

  it('should return null when calldata is only in data', () => {
    expect(getUnsupportedCalldataAlias({ to: '0xdef', data: '0x' })).toBeNull()
  })

  it('should return null for a non-object', () => {
    expect(getUnsupportedCalldataAlias(undefined)).toBeNull()
  })
})
