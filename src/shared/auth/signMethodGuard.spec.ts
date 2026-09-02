import { ImpersonatedSignInError, MalformedSignatureRequestError, UnsupportedMethodError } from './errors'
import {
  assertMethodIsAllowed,
  assertRequestIsNotImpersonatingSignIn,
  canonicalizeSignatureParams,
  isDecentralandIdentityAuthMessage,
  isRetiredSignInMethod
} from './signMethodGuard'

describe('isDecentralandIdentityAuthMessage', () => {
  describe('when the message is a canonical Decentraland sign-in payload', () => {
    let message: string

    beforeEach(() => {
      message = [
        'Decentraland Login',
        'Ephemeral address: 0x1234567890123456789012345678901234567890',
        'Expiration: 2100-01-01T00:00:00.000Z'
      ].join('\n')
    })

    it('should return true', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(true)
    })
  })

  describe('when the message uses a forged first line but keeps the ephemeral structure', () => {
    let message: string

    beforeEach(() => {
      message = [
        'Please sign in to my totally legit dapp',
        'Ephemeral address: 0x1234567890123456789012345678901234567890',
        'Expiration: 2100-01-01T00:00:00.000Z'
      ].join('\n')
    })

    it('should return true because the auth-chain validator ignores the first line', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(true)
    })
  })

  describe('when the message uses carriage returns between lines', () => {
    let message: string

    beforeEach(() => {
      message =
        'Decentraland Login\r\nEphemeral address: 0x1234567890123456789012345678901234567890\r\nExpiration: 2100-01-01T00:00:00.000Z'
    })

    it('should return true after normalizing the carriage returns', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(true)
    })
  })

  describe('when the message is a regular text to be signed', () => {
    let message: string

    beforeEach(() => {
      message = 'Sign this message to prove you own this wallet'
    })

    it('should return false', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(false)
    })
  })

  describe('when the message has fewer than three lines', () => {
    let message: string

    beforeEach(() => {
      message = 'Decentraland Login\nEphemeral address: 0x1234567890123456789012345678901234567890'
    })

    it('should return false', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(false)
    })
  })

  describe('when the ephemeral address line is not a hex address', () => {
    let message: string

    beforeEach(() => {
      message = ['Decentraland Login', 'Ephemeral address: not-an-address', 'Expiration: 2100-01-01T00:00:00.000Z'].join('\n')
    })

    it('should return false', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(false)
    })
  })

  describe('when the value is not a string', () => {
    let message: unknown

    beforeEach(() => {
      message = { foo: 'bar' }
    })

    it('should return false', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(false)
    })
  })
})

describe('assertRequestIsNotImpersonatingSignIn', () => {
  let signInPayload: string

  beforeEach(() => {
    signInPayload = [
      'Decentraland Login',
      'Ephemeral address: 0x1234567890123456789012345678901234567890',
      'Expiration: 2100-01-01T00:00:00.000Z'
    ].join('\n')
  })

  describe('when the method is dcl_personal_sign and the message is a sign-in payload', () => {
    let params: unknown[]

    beforeEach(() => {
      params = [signInPayload]
    })

    it('should throw an ImpersonatedSignInError because no method is exempt anymore', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('dcl_personal_sign', params)).toThrow(ImpersonatedSignInError)
    })
  })

  describe('when the method is personal_sign and the message is a sign-in payload', () => {
    let params: unknown[]

    beforeEach(() => {
      params = [signInPayload]
    })

    it('should throw an ImpersonatedSignInError', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
    })
  })

  describe('when the method is eth_sign and the sign-in payload is not the first param', () => {
    let params: unknown[]

    beforeEach(() => {
      params = ['0x1234567890123456789012345678901234567890', signInPayload]
    })

    it('should throw an ImpersonatedSignInError regardless of the param order', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('eth_sign', params)).toThrow(ImpersonatedSignInError)
    })
  })

  describe('when the method is personal_sign and the sign-in payload is hex-encoded UTF-8', () => {
    let params: unknown[]

    beforeEach(() => {
      // How a wallet actually receives most personal_sign messages. The signature is produced over
      // the DECODED bytes, so this yields the same usable auth chain as the plaintext form.
      params = ['0x' + Buffer.from(signInPayload, 'utf8').toString('hex')]
    })

    it('should throw an ImpersonatedSignInError because detection looks through the encoding', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
    })
  })

  describe('when the hex-encoded sign-in payload uses an uppercase 0X prefix', () => {
    let params: unknown[]

    beforeEach(() => {
      params = ['0X' + Buffer.from(signInPayload, 'utf8').toString('hex').toUpperCase()]
    })

    it('should throw an ImpersonatedSignInError', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
    })
  })

  describe('when the hex-encoded payload is not a sign-in message', () => {
    let params: unknown[]

    beforeEach(() => {
      params = ['0x' + Buffer.from('Sign this message to prove you own this wallet', 'utf8').toString('hex')]
    })

    it('should not throw', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).not.toThrow()
    })
  })

  describe('when a param is a plain hex value that is not decodable text', () => {
    let params: unknown[]

    beforeEach(() => {
      // An address-like param must not be mistaken for an encoded payload, and must not throw.
      params = ['0x1234567890123456789012345678901234567890']
    })

    it('should not throw', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).not.toThrow()
    })
  })

  describe('when a param is malformed hex (odd length)', () => {
    let params: unknown[]

    beforeEach(() => {
      params = ['0xabc']
    })

    it('should not throw', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).not.toThrow()
    })
  })

  describe('when the method is personal_sign and the message is a regular text', () => {
    let params: unknown[]

    beforeEach(() => {
      params = ['Sign this message to prove you own this wallet']
    })

    it('should not throw', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).not.toThrow()
    })
  })

  describe('when the method is eth_sendTransaction with object params', () => {
    let params: unknown[]

    beforeEach(() => {
      params = [{ to: '0xcontract', data: '0x1234', value: '0' }]
    })

    it('should not throw', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('eth_sendTransaction', params)).not.toThrow()
    })
  })

  describe('when the request has no params', () => {
    it('should not throw', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', undefined)).not.toThrow()
    })
  })
})

describe('assertMethodIsAllowed', () => {
  describe.each(['personal_sign', 'eth_signTypedData_v3', 'eth_signTypedData_v4', 'eth_sendTransaction'])(
    'when the method is the allowed method %s',
    method => {
      it('should return it unchanged', () => {
        expect(assertMethodIsAllowed(method)).toBe(method)
      })
    }
  )

  describe('when the method casing differs from the canonical allowlist entry', () => {
    it('should not throw because the check is case-insensitive', () => {
      expect(() => assertMethodIsAllowed('PERSONAL_SIGN')).not.toThrow()
    })

    it('should return the canonical spelling so the case-sensitive dispatch downstream still matches', () => {
      expect(assertMethodIsAllowed('eth_sendtransaction')).toBe('eth_sendTransaction')
    })
  })

  describe('when the method is the dangerous legacy eth_sign', () => {
    it('should throw an UnsupportedMethodError', () => {
      expect(() => assertMethodIsAllowed('eth_sign')).toThrow(UnsupportedMethodError)
    })
  })

  describe('when the method is the legacy eth_signTypedData v1', () => {
    it('should throw an UnsupportedMethodError because no client uses it and its params are reversed', () => {
      expect(() => assertMethodIsAllowed('eth_signTypedData')).toThrow(UnsupportedMethodError)
    })
  })

  describe('when the method is the retired dcl_personal_sign sign-in', () => {
    it('should throw an UnsupportedMethodError', () => {
      expect(() => assertMethodIsAllowed('dcl_personal_sign')).toThrow(UnsupportedMethodError)
    })
  })

  describe('when the method is an unknown method', () => {
    it('should throw an UnsupportedMethodError', () => {
      expect(() => assertMethodIsAllowed('eth_doSomethingWeird')).toThrow(UnsupportedMethodError)
    })
  })
})

describe('isRetiredSignInMethod', () => {
  describe('when the method is the retired sign-in', () => {
    it('should return true', () => {
      expect(isRetiredSignInMethod('dcl_personal_sign')).toBe(true)
    })
  })

  describe('when the retired sign-in casing differs', () => {
    it('should return true because the check is case-insensitive', () => {
      expect(isRetiredSignInMethod('DCL_Personal_Sign')).toBe(true)
    })
  })

  describe('when the method is a supported one', () => {
    it('should return false', () => {
      expect(isRetiredSignInMethod('personal_sign')).toBe(false)
    })
  })
})

describe('canonicalizeSignatureParams', () => {
  const signer = '0x1234567890AbcdEF1234567890aBcdef12345678'
  const statement = JSON.stringify({
    domain: { name: 'Decentraland', version: '1' },
    primaryType: 'Statement',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    types: { Statement: [{ name: 'text', type: 'string' }] },
    message: { text: 'Sign in to Decentraland' }
  })
  const permit = JSON.stringify({
    domain: { name: 'Token', version: '1', chainId: 1, verifyingContract: '0x0000000000000000000000000000000000000001' },
    primaryType: 'Permit',
    types: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    message: { owner: signer, spender: '0x000000000000000000000000000000000000dead', value: '1000', nonce: '0', deadline: '9999999999' }
  })

  describe.each(['eth_signTypedData_v4', 'eth_signTypedData_v3'])('when the method is %s', method => {
    describe('and the params are [signer, typed data]', () => {
      it('should return the params unchanged', () => {
        expect(canonicalizeSignatureParams(method, [signer, permit], signer)).toEqual([signer, permit])
      })
    })

    describe('and the signer casing differs from the connected address', () => {
      it('should return the params unchanged because addresses compare case-insensitively', () => {
        expect(canonicalizeSignatureParams(method, [signer.toLowerCase(), permit], signer)).toEqual([signer.toLowerCase(), permit])
      })
    })

    describe('and the typed data is passed as an object instead of a JSON string', () => {
      it('should return the params unchanged', () => {
        expect(canonicalizeSignatureParams(method, [signer, JSON.parse(permit)], signer)).toEqual([signer, JSON.parse(permit)])
      })
    })

    describe('and both params are typed data, with the harmless one first', () => {
      it('should throw a MalformedSignatureRequestError because the wallet would sign the second one', () => {
        expect(() => canonicalizeSignatureParams(method, [statement, permit], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the params are in the legacy [typed data, signer] order', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams(method, [permit, signer], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the address is not the connected signer', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        const other = '0x0000000000000000000000000000000000000002'
        expect(() => canonicalizeSignatureParams(method, [other, permit], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and there is a single param', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams(method, [permit], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and there is a third param', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams(method, [signer, permit, statement], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and there are no params', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams(method, undefined, signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the typed data is not valid JSON', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams(method, [signer, '{not json'], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the typed data has no primaryType, like a v1 field list', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        const legacy = JSON.stringify([{ type: 'string', name: 'Message', value: 'hi' }])
        expect(() => canonicalizeSignatureParams(method, [signer, legacy], signer)).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('when the method casing differs from the canonical spelling', () => {
    it('should still validate the typed data shape', () => {
      expect(() => canonicalizeSignatureParams('ETH_SIGNTYPEDDATA_V4', [statement, permit], signer)).toThrow(MalformedSignatureRequestError)
    })
  })

  describe('when the method is personal_sign', () => {
    describe('and the params are [message, signer]', () => {
      it('should return the params unchanged', () => {
        expect(canonicalizeSignatureParams('personal_sign', ['hello', signer], signer)).toEqual(['hello', signer])
      })
    })

    describe('and the params are [signer, message]', () => {
      it('should move the signer to the second position so the wallet signs the same message the preview shows', () => {
        expect(canonicalizeSignatureParams('personal_sign', [signer, 'hello'], signer)).toEqual(['hello', signer])
      })
    })

    describe('and the message is hex and the signer is sent in lowercase', () => {
      it('should keep the params and the signer casing as sent', () => {
        const params = ['0x68656c6c6f', signer.toLowerCase()]
        expect(canonicalizeSignatureParams('personal_sign', params, signer)).toEqual(params)
      })
    })

    describe('and the signer is not among the params', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        const other = '0x0000000000000000000000000000000000000002'
        expect(() => canonicalizeSignatureParams('personal_sign', ['hello', other], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and both params are the signer address', () => {
      it('should throw a MalformedSignatureRequestError because the message cannot be told apart', () => {
        expect(() => canonicalizeSignatureParams('personal_sign', [signer, signer], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the message is not a string', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams('personal_sign', [{ text: 'hello' }, signer], signer)).toThrow(
          MalformedSignatureRequestError
        )
      })
    })

    describe('and there is a single param', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => canonicalizeSignatureParams('personal_sign', ['hello'], signer)).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('when the method is eth_sendTransaction', () => {
    it('should return the params untouched because the transaction path builds its own canonical params', () => {
      const params = [{ to: '0x1', data: '0x' }, 'extra']
      expect(canonicalizeSignatureParams('eth_sendTransaction', params, signer)).toBe(params)
    })

    it('should return undefined when there are no params', () => {
      expect(canonicalizeSignatureParams('eth_sendTransaction', undefined, signer)).toBeUndefined()
    })
  })
})
