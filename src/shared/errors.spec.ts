import { UnauthorizedProviderError } from 'viem'
import {
  WalletSignatureUnsupportedError,
  isChainMismatchRejection,
  isExpectedWalletError,
  isMagicNetworkError,
  isUnreportedWalletCondition,
  isUserRejectedTransaction,
  isWalletSignatureUnsupportedError
} from './errors'

/**
 * Mirrors the shape of Magic SDK's `MagicRPCError`: an `Error` carrying the JSON-RPC `code`, the
 * iframe's `rawMessage`, and `data`, with the message the SDK builds from them.
 */
class FakeMagicRPCError extends Error {
  code: number
  rawMessage: string
  data: unknown

  constructor(code: number, rawMessage: string) {
    super(`Magic RPC Error: [${code}] ${rawMessage}`)
    this.code = code
    this.rawMessage = rawMessage
    this.data = undefined
  }
}

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

describe('isWalletSignatureUnsupportedError', () => {
  describe('when the wallet could not be asked to sign the login message', () => {
    it('should match the error the login throws', () => {
      expect(isWalletSignatureUnsupportedError(new WalletSignatureUnsupportedError())).toBe(true)
    })

    it('should match by name, since minification rewrites the class', () => {
      const minified = new Error('The connected wallet did not approve the signing method required to log in')
      minified.name = 'WalletSignatureUnsupportedError'

      expect(isWalletSignatureUnsupportedError(minified)).toBe(true)
    })
  })

  describe('when the failure is anything else', () => {
    it('should not match a user rejection', () => {
      expect(isWalletSignatureUnsupportedError({ code: 4001, message: 'User rejected the request.' })).toBe(false)
    })

    it('should not match non-object values', () => {
      expect(isWalletSignatureUnsupportedError(null)).toBe(false)
      expect(isWalletSignatureUnsupportedError(undefined)).toBe(false)
      expect(isWalletSignatureUnsupportedError('WalletSignatureUnsupportedError')).toBe(false)
    })
  })
})

describe('isExpectedWalletError', () => {
  describe('when the wallet is locked and decentraland-connect gives up', () => {
    it('should classify it as expected', () => {
      const lockedWallet = new Error('There was an error unlocking your wallet. Please be sure your wallet is unlocked and try again.')
      lockedWallet.name = 'ErrorUnlockingWallet'

      expect(isExpectedWalletError(lockedWallet)).toBe(true)
    })
  })

  describe('when the wallet already has a prompt open for this origin', () => {
    it('should classify the EIP-1193 resource-unavailable code as expected', () => {
      const alreadyPending = {
        code: -32002,
        message: "Request of type 'wallet_requestPermissions' already pending for origin https://decentraland.org. Please wait."
      }

      expect(isExpectedWalletError(alreadyPending)).toBe(true)
    })
  })

  describe('when the user dismisses the WalletConnect modal', () => {
    it('should classify it as expected, since it arrives as a bare Error', () => {
      expect(isExpectedWalletError(new Error('User closed the modal without connecting'))).toBe(true)
    })
  })

  describe('when the failure is a genuine fault', () => {
    it('should not classify an internal rpc error as expected', () => {
      expect(isExpectedWalletError({ code: -32603, message: 'Internal error' })).toBe(false)
    })

    it('should not classify a missing provider as expected', () => {
      expect(isExpectedWalletError(new Error('Could not get provider'))).toBe(false)
    })

    it('should not classify an arbitrary error carrying a wallet-ish name as expected', () => {
      const other = new Error('boom')
      other.name = 'SomeOtherError'

      expect(isExpectedWalletError(other)).toBe(false)
    })

    it('should not classify non-object values as expected', () => {
      expect(isExpectedWalletError(null)).toBe(false)
      expect(isExpectedWalletError(undefined)).toBe(false)
      expect(isExpectedWalletError('User closed the modal without connecting')).toBe(false)
    })
  })

  describe('isChainMismatchRejection', () => {
    describe('when the wallet returned invalid params naming the chain', () => {
      it('should recognize a raw provider error', () => {
        expect(isChainMismatchRejection({ code: -32602, message: 'Invalid transaction params: chainId mismatch' })).toBe(true)
      })

      it('should recognize a viem error that carries the provider message in details', () => {
        const error = Object.assign(new Error('Invalid parameters were provided to the RPC method.'), {
          code: -32602,
          details: 'Invalid transaction params: Invalid chainId "0x89": must match the active network'
        })

        expect(isChainMismatchRejection(error)).toBe(true)
      })

      it('should recognize the provider error nested as the cause of a wrapper', () => {
        const error = Object.assign(new Error('Request failed'), {
          cause: { code: -32602, message: 'chainId does not match the current network' }
        })

        expect(isChainMismatchRejection(error)).toBe(true)
      })
    })

    describe('when the failure is something else', () => {
      it('should not classify invalid params about another field', () => {
        expect(isChainMismatchRejection({ code: -32602, message: 'Invalid transaction params: must provide a "to" address' })).toBe(false)
      })

      it('should not classify a user rejection', () => {
        expect(isChainMismatchRejection({ code: 4001, message: 'User rejected the request. chain' })).toBe(false)
      })

      it('should not classify non-object values', () => {
        expect(isChainMismatchRejection(null)).toBe(false)
        expect(isChainMismatchRejection('chainId mismatch')).toBe(false)
      })
    })
  })
})

describe('isUnreportedWalletCondition', () => {
  describe('when the user has switched dApp access off in the wallet', () => {
    it('should match the EIP-1193 unauthorized code with the wallet message', () => {
      expect(isUnreportedWalletCondition({ code: 4100, message: 'DApp interaction is disabled' })).toBe(true)
    })

    it('should match it as an Error carrying the code', () => {
      expect(isUnreportedWalletCondition(Object.assign(new Error('DApp interaction is disabled'), { code: 4100 }))).toBe(true)
    })

    it('should match it once viem wraps it on the signing path', () => {
      const raw = Object.assign(new Error('DApp interaction is disabled'), { code: 4100 })

      expect(isUnreportedWalletCondition(new UnauthorizedProviderError(raw))).toBe(true)
    })

    it('should not match a viem-wrapped unauthorized request with other details', () => {
      const raw = Object.assign(new Error('Account not authorized'), { code: 4100 })

      expect(isUnreportedWalletCondition(new UnauthorizedProviderError(raw))).toBe(false)
    })
  })

  describe('when the wallet is still busy unlocking', () => {
    it('should match the code with the wallet message', () => {
      expect(isUnreportedWalletCondition({ code: -32001, message: 'Already processing unlock. Please wait.' })).toBe(true)
    })
  })

  describe('when the login screen decides what to show', () => {
    it('should stay apart from the expected wallet errors, so the wallet message is kept', () => {
      expect(isExpectedWalletError({ code: 4100, message: 'DApp interaction is disabled' })).toBe(false)
      expect(isExpectedWalletError({ code: -32001, message: 'Already processing unlock. Please wait.' })).toBe(false)
    })
  })

  describe('when the failure is some other refusal', () => {
    it('should not match another unauthorized request', () => {
      expect(
        isUnreportedWalletCondition({ code: 4100, message: 'The requested account and/or method has not been authorized by the user.' })
      ).toBe(false)
    })

    it('should not match another failure carrying -32001', () => {
      expect(isUnreportedWalletCondition({ code: -32001, message: 'Resource not found' })).toBe(false)
    })

    it('should not match the message without the code', () => {
      expect(isUnreportedWalletCondition(new Error('DApp interaction is disabled'))).toBe(false)
    })

    it('should not match non-object values', () => {
      expect(isUnreportedWalletCondition(null)).toBe(false)
      expect(isUnreportedWalletCondition(undefined)).toBe(false)
      expect(isUnreportedWalletCondition('DApp interaction is disabled')).toBe(false)
    })
  })
})

describe('isMagicNetworkError', () => {
  describe('when the browser could not reach Magic', () => {
    it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
      'should recognize the internal error carrying %p',
      rawMessage => {
        expect(isMagicNetworkError(new FakeMagicRPCError(-32603, rawMessage))).toBe(true)
      }
    )
  })

  describe('when the failure is anything else', () => {
    it('should not match a Magic internal error with a different message', () => {
      expect(isMagicNetworkError(new FakeMagicRPCError(-32603, 'Internal error'))).toBe(false)
    })

    it('should not match a network message under a different Magic code', () => {
      expect(isMagicNetworkError(new FakeMagicRPCError(-32600, 'Failed to fetch'))).toBe(false)
    })

    it('should not match an rpc error that is not from Magic', () => {
      expect(isMagicNetworkError({ code: -32603, message: 'Failed to fetch' })).toBe(false)
    })

    it('should not match non-object values', () => {
      expect(isMagicNetworkError(null)).toBe(false)
      expect(isMagicNetworkError(undefined)).toBe(false)
      expect(isMagicNetworkError('Failed to fetch')).toBe(false)
    })
  })
})
