import { assertValidTransactionParams, findInvalidTransactionParam, getTransactionToAddress } from './transactionParams'

describe('getTransactionToAddress', () => {
  describe('when the params carry a well-formed transaction', () => {
    it('should return the destination address', () => {
      const params = [{ from: '0xabc', to: '0xdef', value: '0x0', data: '0x' }]

      expect(getTransactionToAddress(params)).toBe('0xdef')
    })
  })

  describe('when the caller serialised the transaction instead of sending an object', () => {
    // The shape actually seen in production (AUTH-SITE-17J): params[0] arrived as a JSON string,
    // so reading `.to` off it silently yielded undefined and the old message blamed a missing
    // contract address while printing a payload that plainly contained one.
    let params: unknown[]

    beforeEach(() => {
      params = [JSON.stringify({ from: '0x7ec943', to: '0x7ec943', value: '0x0de0b6b3a7640000', data: '0x' })]
    })

    it('should name the type it actually received', () => {
      expect(() => getTransactionToAddress(params)).toThrow(/received string/)
    })

    it('should not claim the destination address is missing', () => {
      expect(() => getTransactionToAddress(params)).not.toThrow(/missing a "to" address/)
    })

    it('should include the payload so the sender can be identified', () => {
      expect(() => getTransactionToAddress(params)).toThrow(/0x0de0b6b3a7640000/)
    })
  })

  describe('when the params are unusable in other ways', () => {
    it('should reject an array in place of the transaction object', () => {
      expect(() => getTransactionToAddress([['0xdef']])).toThrow(/received array/)
    })

    it('should reject a missing params list', () => {
      expect(() => getTransactionToAddress(undefined)).toThrow(/received undefined/)
    })

    it('should reject an empty params list', () => {
      expect(() => getTransactionToAddress([])).toThrow(/received undefined/)
    })

    it('should reject a null transaction object', () => {
      expect(() => getTransactionToAddress([null])).toThrow(/received null/)
    })
  })

  describe('when the transaction object has no usable destination', () => {
    it('should say the address is missing rather than blaming the shape', () => {
      expect(() => getTransactionToAddress([{ from: '0xabc', data: '0x' }])).toThrow(/missing a "to" address/)
    })

    it('should reject a non-string address instead of failing later on it', () => {
      expect(() => getTransactionToAddress([{ to: 42 }])).toThrow(/missing a "to" address/)
    })
  })
})

describe('findInvalidTransactionParam', () => {
  describe('when every field is a standard transaction field', () => {
    it('should return null', () => {
      const txParams = { from: '0xabc', to: '0xdef', value: '0x0', data: '0x', gas: '0x5208' }

      expect(findInvalidTransactionParam(txParams)).toBeNull()
    })
  })

  describe('when a field the preview does not simulate is present', () => {
    it("should return thirdweb's extraCallData", () => {
      expect(findInvalidTransactionParam({ to: '0xdef', data: '0x', extraCallData: '0xa9059cbb' })).toBe('extraCallData')
    })

    it('should reject the input calldata alias, since calldata is read only from data', () => {
      expect(findInvalidTransactionParam({ to: '0xdef', input: '0xa9059cbb' })).toBe('input')
    })
  })

  describe('when the value is not a transaction object', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an array', ['0xdef']]
    ])('should return null for %s', (_label, value) => {
      expect(findInvalidTransactionParam(value)).toBeNull()
    })
  })
})

describe('assertValidTransactionParams', () => {
  describe('when the transaction only uses standard fields', () => {
    it('should not throw', () => {
      const params = [{ from: '0xabc', to: '0xdef', value: '0x0', data: '0x' }]

      expect(() => assertValidTransactionParams(params)).not.toThrow()
    })
  })

  describe('when the transaction carries a field the preview cannot show', () => {
    it('should throw naming extraCallData', () => {
      const params = [{ to: '0xdef', data: '0x', extraCallData: '0xa9059cbb' }]

      expect(() => assertValidTransactionParams(params)).toThrow('Invalid transaction param "extraCallData"')
    })

    it('should throw for the input calldata alias', () => {
      const params = [{ to: '0xdef', input: '0xa9059cbb' }]

      expect(() => assertValidTransactionParams(params)).toThrow('Invalid transaction param "input"')
    })
  })

  describe('when there is no transaction object to validate', () => {
    it('should not throw on an empty params list', () => {
      expect(() => assertValidTransactionParams([])).not.toThrow()
    })

    it('should not throw on a missing params list', () => {
      expect(() => assertValidTransactionParams(undefined)).not.toThrow()
    })
  })
})
