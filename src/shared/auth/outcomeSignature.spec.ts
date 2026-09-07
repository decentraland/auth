import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { createUnsafeIdentity } from '@dcl/crypto/dist/crypto'
import { OutcomeIdentityError, assertOutcomeIdentity, getOutcomeSignaturePayload, signOutcome } from './outcomeSignature'

describe('when signing a request outcome with a delegated identity', () => {
  let identity: AuthIdentity
  let sender: string
  let requestId: string
  let answer: { result: unknown }
  let signed: ReturnType<typeof signOutcome>

  beforeEach(async () => {
    const wallet = createUnsafeIdentity()
    sender = wallet.address
    identity = await Authenticator.initializeAuthChain(sender, createUnsafeIdentity(), 10, async message =>
      Authenticator.createSignature(wallet, message)
    )
    requestId = 'test-request'
    answer = { result: { z: ['CaseSensitive', 2], a: { token: 'Token' } } }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should produce a valid delegated signature without including the private key', async () => {
    signed = signOutcome(identity, requestId, sender, answer)
    expect(
      (
        await Authenticator.validateSignature(
          getOutcomeSignaturePayload(requestId, { sender, result: signed.result, expiresAt: signed.expiresAt }),
          signed.authChain,
          null
        )
      ).ok
    ).toBe(true)
    expect(JSON.stringify(signed)).not.toContain(identity.ephemeralIdentity.privateKey)
  })

  it('should bind the result to the request id', async () => {
    signed = signOutcome(identity, requestId, sender, answer)
    expect(
      (
        await Authenticator.validateSignature(
          getOutcomeSignaturePayload('another-request', { sender, result: signed.result, expiresAt: signed.expiresAt }),
          signed.authChain,
          null
        )
      ).ok
    ).toBe(false)
  })

  it('should use the server protocol canonical JSON vector', () => {
    expect(
      getOutcomeSignaturePayload('r', { sender: 's', expiresAt: 123, result: { z: ['CaseSensitive', 2], a: { token: 'Token' } } })
    ).toBe(
      'decentraland-auth-outcome-v1\n{"expiresAt":123,"requestId":"r","result":{"a":{"token":"Token"},"z":["CaseSensitive",2]},"sender":"s"}'
    )
  })

  describe('and the identity is missing', () => {
    it('should refuse to sign', () => {
      expect(() => signOutcome(undefined, requestId, sender, answer)).toThrow(OutcomeIdentityError)
    })
  })

  describe('and the identity has expired', () => {
    beforeEach(() => {
      identity.expiration = new Date(0)
    })
    it('should fail the pre-execution check', () => {
      expect(() => assertOutcomeIdentity(identity, sender)).toThrow(OutcomeIdentityError)
    })
  })

  describe('and the identity belongs to a different wallet', () => {
    beforeEach(() => {
      sender = '0x1111111111111111111111111111111111111111'
    })
    it('should refuse to sign', () => {
      expect(() => signOutcome(identity, requestId, sender, answer)).toThrow(OutcomeIdentityError)
    })
  })
})
