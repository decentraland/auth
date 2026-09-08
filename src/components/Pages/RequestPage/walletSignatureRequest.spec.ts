import { MalformedSignatureRequestError, UnsupportedMethodError } from '../../../shared/auth'
import { RequestClassification } from './classifyRequest'
import { WalletSignatureRequest, forwardSignatureRequest, toWalletSignatureRequest } from './walletSignatureRequest'

const SIGNER = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
const RAW = '{"primaryType":"Permit"}'

describe('when building the wallet request for a reviewed signature', () => {
  let request: WalletSignatureRequest
  let reviewed: RequestClassification

  describe('and the method is personal_sign', () => {
    describe('and the review is of a personal_sign message', () => {
      beforeEach(() => {
        reviewed = { kind: 'personal_sign', text: 'hello', hex: '0x68656c6c6f' }
        request = toWalletSignatureRequest('personal_sign', reviewed, SIGNER)
      })

      it('should send the bytes the review displayed and the signer', () => {
        expect(request).toEqual({ method: 'personal_sign', params: ['0x68656c6c6f', SIGNER] })
      })
    })

    describe('and the review is of typed data', () => {
      beforeEach(() => {
        reviewed = { kind: 'unknown_typed_data', typedData: {}, raw: RAW }
      })

      it('should throw a MalformedSignatureRequestError instead of forwarding another review', () => {
        expect(() => toWalletSignatureRequest('personal_sign', reviewed, SIGNER)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the signer is not an address', () => {
      beforeEach(() => {
        reviewed = { kind: 'personal_sign', text: 'hello', hex: '0x68656c6c6f' }
      })

      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => toWalletSignatureRequest('personal_sign', reviewed, 'not-an-address')).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe.each(['eth_signTypedData_v3', 'eth_signTypedData_v4'] as const)('and the method is %s', method => {
    describe('and the review is of typed data Decentraland cannot check', () => {
      beforeEach(() => {
        reviewed = { kind: 'unknown_typed_data', typedData: { primaryType: 'Permit' }, raw: RAW }
        request = toWalletSignatureRequest(method, reviewed, SIGNER)
      })

      it('should send the signer and the JSON the review displayed', () => {
        expect(request).toEqual({ method, params: [SIGNER, RAW] })
      })
    })

    describe('and the review is of a MetaTransaction Decentraland cannot vouch for', () => {
      beforeEach(() => {
        reviewed = {
          kind: 'unknown_meta_transaction',
          typedData: { primaryType: 'MetaTransaction' },
          raw: RAW,
          verifyingContract: null,
          chainId: null,
          reason: 'malformed'
        }
        request = toWalletSignatureRequest(method, reviewed, SIGNER)
      })

      it('should send the signer and the JSON the review displayed', () => {
        expect(request).toEqual({ method, params: [SIGNER, RAW] })
      })
    })

    describe('and the review is of a personal_sign message', () => {
      beforeEach(() => {
        reviewed = { kind: 'personal_sign', text: 'hello', hex: '0x68656c6c6f' }
      })

      it('should throw a MalformedSignatureRequestError instead of forwarding another review', () => {
        expect(() => toWalletSignatureRequest(method, reviewed, SIGNER)).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('and the method is not a signing method this page forwards', () => {
    beforeEach(() => {
      reviewed = { kind: 'personal_sign', text: 'hello', hex: '0x68656c6c6f' }
    })

    it('should throw an UnsupportedMethodError instead of forwarding it', () => {
      expect(() => toWalletSignatureRequest('eth_sendTransaction', reviewed, SIGNER)).toThrow(UnsupportedMethodError)
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
      request = { method: 'eth_signTypedData_v4', params: [SIGNER, RAW] }
    })

    it('should call the wallet with that method and those params', async () => {
      await forwardSignatureRequest({ request: walletRequest }, request)
      expect(walletRequest).toHaveBeenCalledWith({ method: 'eth_signTypedData_v4', params: [SIGNER, RAW] })
    })
  })
})
