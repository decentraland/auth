import { isUserRejectedTransaction } from './errors'

/**
 * `@web3-react/injected-connector` throws this when the user dismisses the wallet prompt during
 * `connection.connect()`. It carries no EIP-1193 `code`, and its `name` is assigned from
 * `this.constructor.name`, which minifies to a single letter in production — so the message is the
 * only stable signal.
 */
class Web3ReactUserRejectedRequestError extends Error {
  constructor() {
    super()
    this.name = this.constructor.name
    this.message = 'The user rejected the request.'
  }
}

describe('isUserRejectedTransaction', () => {
  describe('when the user dismisses the wallet prompt while connecting', () => {
    it('should detect the error web3-react throws, which carries no code', () => {
      expect(isUserRejectedTransaction(new Web3ReactUserRejectedRequestError())).toBe(true)
    })

    it('should detect it after minification has rewritten the error name', () => {
      const minified = new Web3ReactUserRejectedRequestError()
      minified.name = 'n'

      expect(isUserRejectedTransaction(minified)).toBe(true)
    })
  })

  describe('when the wallet reports the rejection through an EIP-1193 code', () => {
    it('should detect viem UserRejectedRequestError', () => {
      expect(isUserRejectedTransaction({ code: 4001, message: 'User rejected the request.' })).toBe(true)
    })

    it('should detect the ethers v6 rejection', () => {
      expect(isUserRejectedTransaction({ code: 'ACTION_REJECTED', message: 'user rejected action' })).toBe(true)
    })

    it('should detect the decentraland-transactions rejection', () => {
      expect(isUserRejectedTransaction({ code: 'user_denied', message: 'User denied message signature' })).toBe(true)
    })

    it('should detect the rejection decentraland-transactions misclassifies as unknown', () => {
      expect(isUserRejectedTransaction({ code: 'unknown', message: 'User rejected the request.' })).toBe(true)
    })
  })

  describe('when the failure is not a user rejection', () => {
    it('should not match a locked wallet', () => {
      expect(isUserRejectedTransaction(new Error('There was an error unlocking your wallet.'))).toBe(false)
    })

    it('should not match an unrelated rpc failure', () => {
      expect(isUserRejectedTransaction({ code: -32603, message: 'Internal error' })).toBe(false)
    })

    it('should not match an arbitrary error', () => {
      expect(isUserRejectedTransaction(new Error('Could not get provider'))).toBe(false)
    })

    it('should not match non-object values', () => {
      expect(isUserRejectedTransaction(null)).toBe(false)
      expect(isUserRejectedTransaction(undefined)).toBe(false)
      expect(isUserRejectedTransaction('The user rejected the request.')).toBe(false)
    })
  })
})
