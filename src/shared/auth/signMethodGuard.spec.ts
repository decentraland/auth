import { ImpersonatedSignInError } from './errors'
import { assertRequestIsNotImpersonatingSignIn, isDecentralandIdentityAuthMessage } from './signMethodGuard'

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

  describe('when the method is dcl_personal_sign', () => {
    let params: unknown[]

    beforeEach(() => {
      params = [signInPayload]
    })

    it('should not throw even when the message is a sign-in payload', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('dcl_personal_sign', params)).not.toThrow()
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
