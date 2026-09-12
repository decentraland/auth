import { ErrorCode, MetaTransactionError, sendMetaTransaction } from 'decentraland-transactions'
import { isUserRejectedTransaction } from '../errors'
import { ReviewedRequestInvalidatedError, ReviewedSignerMismatchError, bindProviderToSigner } from './signerBoundProvider'

const SIGNER = '0xD9b96b5DC720fc52BEDE1ec3B40A930e15F70Ddd'
const OTHER = '0x1234567890abcdef1234567890abcdef12345678'

describe('when binding a provider to the reviewed signer', () => {
  let request: jest.Mock
  let bound: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

  beforeEach(() => {
    request = jest.fn()
    bound = bindProviderToSigner({ request }, SIGNER) as typeof bound
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the wallet reports the reviewed signer in another casing', () => {
    beforeEach(() => {
      request.mockResolvedValue([SIGNER.toLowerCase()])
    })

    it('should return the accounts as the wallet gave them', async () => {
      await expect(bound.request({ method: 'eth_requestAccounts', params: [] })).resolves.toEqual([SIGNER.toLowerCase()])
    })
  })

  describe('and the wallet reports another account', () => {
    beforeEach(() => {
      request.mockResolvedValue([OTHER])
    })

    it.each(['eth_requestAccounts', 'eth_accounts'])('should refuse %s with a signer mismatch', async method => {
      await expect(bound.request({ method, params: [] })).rejects.toBeInstanceOf(ReviewedSignerMismatchError)
    })

    it('should throw an error decentraland-transactions rethrows as is', async () => {
      await expect(bound.request({ method: 'eth_accounts', params: [] })).rejects.toBeInstanceOf(MetaTransactionError)
    })
  })

  describe('and the wallet answers the account read with a JSON-RPC envelope naming another account', () => {
    beforeEach(() => {
      request.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: [OTHER] })
    })

    it('should read the result out of the envelope and refuse it', async () => {
      await expect(bound.request({ method: 'eth_accounts', params: [] })).rejects.toBeInstanceOf(ReviewedSignerMismatchError)
    })
  })

  describe('and the wallet reports no account', () => {
    beforeEach(() => {
      request.mockResolvedValue([])
    })

    it('should refuse the read', async () => {
      await expect(bound.request({ method: 'eth_accounts', params: [] })).rejects.toBeInstanceOf(ReviewedSignerMismatchError)
    })
  })

  describe('and a typed-data signature is requested for the reviewed signer', () => {
    beforeEach(() => {
      request.mockResolvedValue('0xsignature')
    })

    it('should forward it untouched and return the signature', async () => {
      await expect(bound.request({ method: 'eth_signTypedData_v4', params: [SIGNER, '{}'] })).resolves.toBe('0xsignature')
      expect(request).toHaveBeenCalledWith({ method: 'eth_signTypedData_v4', params: [SIGNER, '{}'] })
    })
  })

  describe('and a typed-data signature is requested for another account', () => {
    it('should refuse it before it reaches the wallet', async () => {
      await expect(bound.request({ method: 'eth_signTypedData_v4', params: [OTHER, '{}'] })).rejects.toBeInstanceOf(
        ReviewedSignerMismatchError
      )
      expect(request).not.toHaveBeenCalled()
    })
  })

  describe('and a personal_sign is requested for another account', () => {
    it('should refuse it before it reaches the wallet', async () => {
      await expect(bound.request({ method: 'personal_sign', params: ['0x68656c6c6f', OTHER] })).rejects.toBeInstanceOf(
        ReviewedSignerMismatchError
      )
      expect(request).not.toHaveBeenCalled()
    })
  })

  describe('and a transaction from another account is requested', () => {
    it('should refuse it before it reaches the wallet', async () => {
      await expect(bound.request({ method: 'eth_sendTransaction', params: [{ from: OTHER, to: SIGNER }] })).rejects.toBeInstanceOf(
        ReviewedSignerMismatchError
      )
      expect(request).not.toHaveBeenCalled()
    })
  })

  describe('and a read that names no account is requested', () => {
    beforeEach(() => {
      request.mockResolvedValue('0x1')
    })

    it('should forward it untouched', async () => {
      await expect(bound.request({ method: 'eth_call', params: [{ to: OTHER, data: '0x' }, 'latest'] })).resolves.toBe('0x1')
    })
  })

  describe('and the underlying provider only has a legacy send', () => {
    let send: jest.Mock

    beforeEach(() => {
      send = jest.fn().mockResolvedValue([SIGNER])
    })

    it('should refuse to bind rather than forward through a path the binding does not read', () => {
      expect(() => bindProviderToSigner({ send }, SIGNER)).toThrow('no EIP-1193 request method')
    })
  })

  describe('and the real relay library encounters a wallet cancellation', () => {
    let networkRequest: jest.Mock
    let outcome: unknown

    beforeEach(async () => {
      request.mockResolvedValueOnce([SIGNER]).mockResolvedValueOnce('0x').mockRejectedValueOnce({ code: 4001, message: 'User rejected' })
      networkRequest = jest.fn().mockResolvedValueOnce('0x0')
      outcome = await sendMetaTransaction({ request: bound.request }, { request: networkRequest }, '0xabcd', {
        address: OTHER,
        abi: [],
        name: 'Test',
        version: '1',
        chainId: 137
      }).catch(error => error)
    })

    it('should preserve the cancellation code through the relay library', () => {
      expect(outcome).toMatchObject({ code: ErrorCode.USER_DENIED, message: 'User rejected' })
    })

    it('should let the page recognize the result as a cancellation', () => {
      expect(isUserRejectedTransaction(outcome)).toBe(true)
    })
  })

  describe('and the wallet rejects without an error message', () => {
    beforeEach(() => {
      request.mockRejectedValueOnce({ code: 4001 })
    })

    it('should preserve the cancellation with a fallback message', async () => {
      await expect(bound.request({ method: 'eth_signTypedData_v4', params: [SIGNER, '{}'] })).rejects.toMatchObject({
        code: ErrorCode.USER_DENIED,
        message: 'User rejected the request.'
      })
    })
  })

  describe('and the wallet fails for a reason other than cancellation', () => {
    let failure: Error

    beforeEach(() => {
      failure = new Error('RPC unavailable')
      request.mockRejectedValueOnce(failure)
    })

    it('should preserve the original failure', async () => {
      await expect(bound.request({ method: 'eth_signTypedData_v4', params: [SIGNER, '{}'] })).rejects.toBe(failure)
    })
  })

  describe('and the review is invalidated before signing', () => {
    let failure: ReviewedRequestInvalidatedError
    let networkRequest: jest.Mock

    beforeEach(() => {
      failure = new ReviewedRequestInvalidatedError()
      bound = bindProviderToSigner({ request }, SIGNER, () => {
        throw failure
      }) as typeof bound
      request.mockResolvedValueOnce([SIGNER]).mockResolvedValueOnce('0x')
      networkRequest = jest.fn().mockResolvedValueOnce('0x0')
    })

    it('should stop the real relay before any wallet signature and preserve the invalidation error', async () => {
      await expect(
        sendMetaTransaction({ request: bound.request }, { request: networkRequest }, '0xabcd', {
          address: OTHER,
          abi: [],
          name: 'Test',
          version: '1',
          chainId: 137
        })
      ).rejects.toBe(failure)
      expect(request.mock.calls.map(([args]) => args.method)).toEqual(['eth_requestAccounts', 'eth_getCode'])
    })
  })

  describe('and the request expires while the relay waits for a wallet signature', () => {
    let failure: ReviewedRequestInvalidatedError
    let expired: boolean
    let resolveSignature: (signature: string) => void
    let signatureRequested: Promise<void>
    let markSignatureRequested: () => void
    let signature: string
    let relay: Promise<string>
    let fetchSpy: jest.SpyInstance
    let networkRequest: jest.Mock

    beforeEach(async () => {
      failure = new ReviewedRequestInvalidatedError()
      expired = false
      signature = `0x${'11'.repeat(64)}1b`
      signatureRequested = new Promise(resolve => {
        markSignatureRequested = resolve
      })
      request
        .mockResolvedValueOnce([SIGNER])
        .mockResolvedValueOnce('0x')
        .mockImplementationOnce(() => {
          markSignatureRequested()
          return new Promise<string>(resolve => {
            resolveSignature = resolve
          })
        })
      networkRequest = jest.fn().mockResolvedValueOnce('0x0')
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => ({ txHash: '0xtransaction' }) } as Response)
      bound = bindProviderToSigner({ request }, SIGNER, undefined, () => {
        if (expired) throw failure
      }) as typeof bound
      relay = sendMetaTransaction({ request: bound.request }, { request: networkRequest }, '0xabcd', {
        address: OTHER,
        abi: [],
        name: 'Test',
        version: '1',
        chainId: 137
      })
      await signatureRequested
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should stop the real relay before posting the expired signature', async () => {
      expired = true
      resolveSignature(signature)
      await expect(relay).rejects.toBe(failure)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    describe('and the signature instead arrives before expiry', () => {
      it('should let the real relay submit the signed transaction', async () => {
        resolveSignature(signature)
        await expect(relay).resolves.toBe('0xtransaction')
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('and a broadcast transaction returns after the signature deadline', () => {
    let afterSigning: jest.Mock
    let resolveTransaction: (hash: string) => void
    let transaction: Promise<unknown>

    beforeEach(() => {
      afterSigning = jest.fn(() => {
        throw new ReviewedRequestInvalidatedError()
      })
      request.mockReturnValueOnce(
        new Promise<string>(resolve => {
          resolveTransaction = resolve
        })
      )
      bound = bindProviderToSigner({ request }, SIGNER, undefined, afterSigning) as typeof bound
      transaction = bound.request({ method: 'eth_sendTransaction', params: [{ from: SIGNER, to: OTHER }] })
    })

    it('should preserve the transaction hash without running the signature-only check', async () => {
      resolveTransaction('0xbroadcast')
      await expect(transaction).resolves.toBe('0xbroadcast')
      expect(afterSigning).not.toHaveBeenCalled()
    })
  })
})
