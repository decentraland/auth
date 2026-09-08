import { stringToHex } from 'viem'
import { MalformedSignatureRequestError, UnsupportedMethodError } from '../../../shared/auth'
import { WalletSignatureRequest, forwardSignatureRequest, toWalletSignatureRequest } from './walletSignatureRequest'

const SIGNER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'

describe('when building the wallet request for a signature', () => {
  let request: WalletSignatureRequest

  describe('and the method is personal_sign', () => {
    describe('and the message is plain text', () => {
      beforeEach(() => {
        request = toWalletSignatureRequest('personal_sign', ['hello', SIGNER])
      })

      it('should send the UTF-8 bytes of the message and the signer', () => {
        expect(request).toEqual({ method: 'personal_sign', params: ['0x68656c6c6f', SIGNER] })
      })
    })

    describe('and the message is already hex', () => {
      beforeEach(() => {
        request = toWalletSignatureRequest('personal_sign', ['0x68656c6c6f', SIGNER])
      })

      it('should send the bytes as they are', () => {
        expect(request).toEqual({ method: 'personal_sign', params: ['0x68656c6c6f', SIGNER] })
      })
    })

    describe('and the message is hex with an uppercase 0X prefix', () => {
      beforeEach(() => {
        request = toWalletSignatureRequest('personal_sign', ['0X68656c6c6f', SIGNER])
      })

      it('should send the UTF-8 bytes of the literal string, as the review displayed it', () => {
        expect(request).toEqual({ method: 'personal_sign', params: [stringToHex('0X68656c6c6f'), SIGNER] })
      })
    })

    describe('and the message is the bare 0x prefix', () => {
      beforeEach(() => {
        request = toWalletSignatureRequest('personal_sign', ['0x', SIGNER])
      })

      it('should send the UTF-8 bytes of "0x" rather than empty bytes', () => {
        expect(request).toEqual({ method: 'personal_sign', params: ['0x3078', SIGNER] })
      })
    })

    describe('and the signer is not an address', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => toWalletSignatureRequest('personal_sign', ['hello', 'not-an-address'])).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the message is not a string', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => toWalletSignatureRequest('personal_sign', [{ text: 'hello' }, SIGNER])).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe.each(['eth_signTypedData_v3', 'eth_signTypedData_v4'] as const)('and the method is %s', method => {
    describe('and the typed data is a JSON string', () => {
      beforeEach(() => {
        request = toWalletSignatureRequest(method, [SIGNER, '{"primaryType":"Permit"}'])
      })

      it('should send the signer and the string untouched', () => {
        expect(request).toEqual({ method, params: [SIGNER, '{"primaryType":"Permit"}'] })
      })
    })

    describe('and the typed data is an object', () => {
      beforeEach(() => {
        request = toWalletSignatureRequest(method, [SIGNER, { primaryType: 'Permit' }])
      })

      it('should send its JSON so the wallet gets the schema form', () => {
        expect(request).toEqual({ method, params: [SIGNER, '{"primaryType":"Permit"}'] })
      })
    })

    describe('and the signer is missing', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => toWalletSignatureRequest(method, ['{"primaryType":"Permit"}'])).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('and the method is not a signing method this page forwards', () => {
    it('should throw an UnsupportedMethodError instead of forwarding it', () => {
      expect(() => toWalletSignatureRequest('eth_sendTransaction', [{ to: SIGNER }])).toThrow(UnsupportedMethodError)
    })
  })
})

describe('when forwarding a signature request to the wallet', () => {
  let walletRequest: jest.Mock
  let request: WalletSignatureRequest

  beforeEach(() => {
    walletRequest = jest.fn().mockResolvedValue('0xsignature')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and it is a personal_sign', () => {
    beforeEach(() => {
      request = { method: 'personal_sign', params: ['0x68656c6c6f', SIGNER] }
    })

    it('should call the wallet with that method and those params and return the signature', async () => {
      await expect(forwardSignatureRequest({ request: walletRequest }, request)).resolves.toBe('0xsignature')
      expect(walletRequest).toHaveBeenCalledWith({ method: 'personal_sign', params: ['0x68656c6c6f', SIGNER] })
    })
  })

  describe('and it is typed data', () => {
    beforeEach(() => {
      request = { method: 'eth_signTypedData_v4', params: [SIGNER, '{"primaryType":"Permit"}'] }
    })

    it('should call the wallet with that method and those params', async () => {
      await forwardSignatureRequest({ request: walletRequest }, request)
      expect(walletRequest).toHaveBeenCalledWith({ method: 'eth_signTypedData_v4', params: [SIGNER, '{"primaryType":"Permit"}'] })
    })
  })
})
