import { getTransactionToAddress } from './transactionParams'

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
