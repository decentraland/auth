import { ImpersonatedSignInError, UnsupportedMethodError } from './errors'
import {
  assertMethodIsAllowed,
  assertRequestIsNotImpersonatingSignIn,
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
  describe.each(['personal_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4', 'eth_sendTransaction'])(
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
