import { buildTransactionParams } from './transactionParams'

describe('buildTransactionParams', () => {
  describe('when the request carries only the reviewed fields', () => {
    it('should keep them and drop from', () => {
      const params = [{ from: '0xabc', to: '0xdef', value: '0x1', data: '0xdead' }]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0xdead', value: '0x1' }])
    })
  })

  describe('when the request carries extra fields', () => {
    it('should keep only to, data and value', () => {
      const params = [
        { to: '0xdef', data: '0x', value: '0x0', maxFeePerGas: '0xffffffffff', gas: '0x5208', nonce: '0x1', extraCallData: '0xa9059cbb' }
      ]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })
  })

  describe('when data and value are missing', () => {
    it('should default them', () => {
      expect(buildTransactionParams([{ to: '0xdef' }])).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })
  })

  describe('when there is no usable transaction object', () => {
    it.each([
      ['a missing params list', undefined],
      ['an empty params list', []],
      ['a null transaction object', [null]],
      ['a serialised transaction', [JSON.stringify({ to: '0xdef' })]]
    ])('should return an empty transaction for %s', (_label, value) => {
      expect(buildTransactionParams(value as unknown[] | undefined)).toEqual([{ data: '0x', value: '0x0' }])
    })
  })

  describe('when the request carries a non-reviewed field', () => {
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
      'blobVersionedHashes',
      'extraCallData'
    ])('should drop %s so it never reaches the wallet', field => {
      const params = [{ to: '0xdef', data: '0x', value: '0x0', [field]: '0xdeadbeef' }]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })
  })

  describe('when the request carries inflated EIP-1559 fee values', () => {
    it('should drop maxFeePerGas and maxPriorityFeePerGas so the wallet sets the network fee', () => {
      const params = [
        { to: '0xdef', data: '0x', value: '0x0', gas: '0x5208', maxFeePerGas: '42857142857142', maxPriorityFeePerGas: '42857142857142' }
      ]

      expect(buildTransactionParams(params)).toEqual([{ to: '0xdef', data: '0x', value: '0x0' }])
    })
  })
})
