import { DOMAIN_TYPE, OFFCHAIN_META_TRANSACTION_TYPE } from 'decentraland-transactions'
import { ImpersonatedSignInError, MalformedSignatureRequestError, MalformedTransactionRequestError, UnsupportedMethodError } from './errors'
import {
  assertMethodIsAllowed,
  assertRequestIsNotImpersonatingSignIn,
  assertSignatureParamsAreCanonical,
  assertTransactionParamsAreCanonical,
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

  describe('when the message keeps the ephemeral structure at the same offsets but re-prefixes lines two and three', () => {
    let message: string

    beforeEach(() => {
      // A forgery: the address and expiration sit at the exact offsets @dcl/crypto slices from
      // (past 'Ephemeral address: ' and 'Expiration: '), but the prefixes differ. The consumer
      // ignores the prefixes, so this still yields a usable auth chain and must be detected.
      const addressLine = 'x'.repeat('Ephemeral address: '.length) + '0x1234567890123456789012345678901234567890'
      const expirationLine = 'x'.repeat('Expiration: '.length) + '2100-01-01T00:00:00.000Z'
      message = ['Please sign in to continue', addressLine, expirationLine].join('\n')
    })

    it('should return true because the consumer reads by offset, not by the prefix', () => {
      expect(isDecentralandIdentityAuthMessage(message)).toBe(true)
    })
  })

  describe('when an address sits at the right offset but the third line has no parseable expiration', () => {
    let message: string

    beforeEach(() => {
      const addressLine = 'x'.repeat('Ephemeral address: '.length) + '0x1234567890123456789012345678901234567890'
      message = ['Header', addressLine, 'no date here at all'].join('\n')
    })

    it('should return false because the consumer could not derive an expiration', () => {
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

  describe.each(['1234567890abcdef1234567890abcdef12345678', '1234567890ABCDEF1234567890ABCDEF12345678'])(
    'when the identity authority is the unprefixed address %s',
    authority => {
      let params: unknown[]

      beforeEach(() => {
        signInPayload = ['Decentraland Login', `Ephemeral address: ${authority}`, 'Expiration: 2100-01-01T00:00:00.000Z'].join('\n')
        params = [signInPayload]
      })

      it('should reject the identity authorization', () => {
        expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
      })

      describe('and the message is encoded as wallet bytes', () => {
        beforeEach(() => {
          params = ['0x' + Buffer.from(signInPayload, 'utf8').toString('hex')]
        })

        it('should reject the identity authorization', () => {
          expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
        })
      })
    }
  )

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

  describe('when the sign-in payload re-prefixes lines two and three to evade a literal-prefix check', () => {
    let params: unknown[]

    beforeEach(() => {
      const addressLine = 'x'.repeat('Ephemeral address: '.length) + '0x1234567890123456789012345678901234567890'
      const expirationLine = 'x'.repeat('Expiration: '.length) + '2100-01-01T00:00:00.000Z'
      const forgedPayload = ['Please sign in to continue', addressLine, expirationLine].join('\n')
      params = [forgedPayload]
    })

    it('should throw an ImpersonatedSignInError because the payload still yields a usable auth chain', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
    })
  })

  describe('when the re-prefixed sign-in payload is hex-encoded UTF-8', () => {
    let params: unknown[]

    beforeEach(() => {
      const addressLine = 'x'.repeat('Ephemeral address: '.length) + '0x1234567890123456789012345678901234567890'
      const expirationLine = 'x'.repeat('Expiration: '.length) + '2100-01-01T00:00:00.000Z'
      const forgedPayload = ['Please sign in to continue', addressLine, expirationLine].join('\n')
      params = ['0x' + Buffer.from(forgedPayload, 'utf8').toString('hex')]
    })

    it('should throw an ImpersonatedSignInError because detection looks through the encoding', () => {
      expect(() => assertRequestIsNotImpersonatingSignIn('personal_sign', params)).toThrow(ImpersonatedSignInError)
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

describe('assertSignatureParamsAreCanonical', () => {
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
      it('should not throw', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer, permit], signer)).not.toThrow()
      })
    })

    describe('and the signer casing differs from the connected address', () => {
      it('should not throw because addresses compare case-insensitively', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer.toLowerCase(), permit], signer)).not.toThrow()
      })
    })

    describe('and the typed data is passed as an object instead of a JSON string', () => {
      it('should not throw', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer, JSON.parse(permit)], signer)).not.toThrow()
      })
    })

    describe('and the typed data is larger than the review can take', () => {
      let oversized: string

      beforeEach(() => {
        oversized = JSON.stringify({ ...JSON.parse(permit), message: { note: 'x'.repeat(96 * 1024) } })
      })

      it('should throw a MalformedSignatureRequestError naming the size', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer, oversized], signer)).toThrow('too large to review')
      })

      it('should judge an object payload by its JSON size', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer, JSON.parse(oversized)], signer)).toThrow('too large to review')
      })
    })

    describe.each(['string', 'object'])('and the typed data arrives as a %s with excessive nesting', representation => {
      let params: unknown[]
      let raw: string

      describe.each([
        ['arrays', '[', ']'],
        ['objects', '{"value":', '}']
      ])('and the message contains deeply nested %s', (_shape, open, close) => {
        beforeEach(() => {
          raw = '{"primaryType":"Permit","message":' + open.repeat(1500) + '0' + close.repeat(1500) + '}'
          params = [signer, representation === 'string' ? raw : JSON.parse(raw)]
        })

        it('should reject the request before formatting or signing its contents', () => {
          expect(() => assertSignatureParamsAreCanonical(method, params, signer)).toThrow(MalformedSignatureRequestError)
        })
      })
    })

    describe.each([
      ['an integer a double cannot hold', '9007199254740993'],
      ['a negative integer a double cannot hold', '-9007199254740993'],
      ['a collection item id', '105312291668557186697918027683670432318895095400549111254310977736'],
      ['a fraction', '1.5'],
      ['an exponent', '1e3']
    ])('and the typed data text carries %s as a bare number', (_label, literal) => {
      let params: unknown[]

      beforeEach(() => {
        params = [signer, `{"primaryType":"Permit","message":{"value":${literal}}}`]
      })

      it('should refuse it, since serializing it for the wallet would change what is signed', () => {
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).toThrow('cannot be represented exactly')
      })
    })

    describe.each([
      ['a wei amount of 10^18', '1000000000000000000'],
      ['a wei amount of 10^20', '100000000000000000000'],
      ['the largest safe integer', '9007199254740991'],
      ['zero', '0'],
      ['a negative integer', '-42']
    ])('and the typed data text carries %s as a bare number', (_label, literal) => {
      let params: unknown[]

      beforeEach(() => {
        params = [signer, `{"primaryType":"Permit","message":{"value":${literal}}}`]
      })

      it('should keep the request reviewable, since a double holds that value exactly', () => {
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).not.toThrow()
      })
    })

    describe('and the typed data text carries large numbers only inside strings', () => {
      let params: unknown[]

      beforeEach(() => {
        params = [signer, '{"primaryType":"Permit","message":{"amount":"9007199254740993","note":"quoted \\" 1.5 e10"}}']
      })

      it('should keep the request reviewable', () => {
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).not.toThrow()
      })
    })

    describe('and the typed data text is not JSON at all', () => {
      let params: unknown[]

      beforeEach(() => {
        params = [signer, 'sign 9007199254740993 please']
      })

      it('should refuse it as malformed typed data rather than blame a number', () => {
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).toThrow(MalformedSignatureRequestError)
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).not.toThrow('cannot be represented exactly')
      })
    })

    describe('and object nesting exceeds the serializer call stack', () => {
      let params: unknown[]

      beforeEach(() => {
        params = [signer, JSON.parse('{"primaryType":"Permit","message":' + '['.repeat(12000) + '0' + ']'.repeat(12000) + '}')]
      })

      it('should refuse it as malformed without overflowing the stack', () => {
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the message has ordinary nested structures', () => {
      let params: unknown[]

      beforeEach(() => {
        params = [signer, JSON.parse('{"primaryType":"Permit","message":' + '{"value":'.repeat(8) + '0' + '}'.repeat(8) + '}')]
      })

      it('should keep the request reviewable', () => {
        expect(() => assertSignatureParamsAreCanonical(method, params, signer)).not.toThrow()
      })
    })

    describe('and both params are typed data, with the harmless one first', () => {
      it('should throw a MalformedSignatureRequestError because the wallet would sign the second one', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [statement, permit], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the params are in the legacy [typed data, signer] order', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [permit, signer], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the address is not the connected signer', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        const other = '0x0000000000000000000000000000000000000002'
        expect(() => assertSignatureParamsAreCanonical(method, [other, permit], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and there is a single param', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [permit], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and there is a third param', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer, permit, statement], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and there are no params', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical(method, undefined, signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the typed data is not valid JSON', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical(method, [signer, '{not json'], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the typed data has no primaryType, like a v1 field list', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        const legacy = JSON.stringify([{ type: 'string', name: 'Message', value: 'hi' }])
        expect(() => assertSignatureParamsAreCanonical(method, [signer, legacy], signer)).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('when the typed data is an off-chain marketplace Trade rather than a MetaTransaction', () => {
    let signerAddress: string
    let trade: string

    beforeEach(() => {
      signerAddress = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
      trade = JSON.stringify({
        domain: {
          name: 'DecentralandMarketplacePolygon',
          version: '1.0.0',
          chainId: 137,
          verifyingContract: '0xa40b1d129b8906888720686f3a01921ddf37716f'
        },
        primaryType: 'Trade',
        types: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Trade: [
            { name: 'checks', type: 'Checks' },
            { name: 'sent', type: 'AssetWithoutBeneficiary[]' },
            { name: 'received', type: 'Asset[]' }
          ],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Checks: [
            { name: 'uses', type: 'uint256' },
            { name: 'expiration', type: 'uint256' }
          ],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          AssetWithoutBeneficiary: [{ name: 'value', type: 'uint256' }],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Asset: [{ name: 'value', type: 'uint256' }]
        },
        message: { checks: { uses: 1, expiration: 1 }, sent: [], received: [] }
      })
    })

    it('should accept a complete generic schema without imposing the MetaTransaction struct', () => {
      expect(() => assertSignatureParamsAreCanonical('eth_signTypedData_v4', [signerAddress, trade], signerAddress)).not.toThrow()
    })
  })

  describe('when the typed data is a MetaTransaction', () => {
    let signerAddress: string
    let typedData: Record<string, unknown>

    beforeEach(() => {
      signerAddress = '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd'
      typedData = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        types: { EIP712Domain: DOMAIN_TYPE, MetaTransaction: OFFCHAIN_META_TRANSACTION_TYPE },
        domain: {
          name: 'DecentralandMarketplacePolygon',
          version: '1.0.0',
          verifyingContract: '0xa40b1d129b8906888720686f3a01921ddf37716f',
          salt: '0x0000000000000000000000000000000000000000000000000000000000000089'
        },
        primaryType: 'MetaTransaction',
        message: { nonce: 0, from: signerAddress, functionData: `0xdeadbeef${'00'.repeat(64)}` }
      }
    })

    describe('and it is shaped the way decentraland-transactions builds it', () => {
      it('should not throw', () => {
        expect(() =>
          assertSignatureParamsAreCanonical('eth_signTypedData_v4', [signerAddress, JSON.stringify(typedData)], signerAddress)
        ).not.toThrow()
      })
    })

    describe('and its message carries a second call in a field the struct does not declare', () => {
      beforeEach(() => {
        typedData.message = { ...(typedData.message as Record<string, unknown>), functionSignature: `0x2d0335ab${'00'.repeat(32)}` }
      })

      it('should not throw, because the request classifier decides that such a MetaTransaction is shown as unverified', () => {
        expect(() =>
          assertSignatureParamsAreCanonical('eth_signTypedData_v4', [signerAddress, JSON.stringify(typedData)], signerAddress)
        ).not.toThrow()
      })
    })
  })

  describe('when the method casing differs from the canonical spelling', () => {
    it('should still validate the typed data shape', () => {
      expect(() => assertSignatureParamsAreCanonical('ETH_SIGNTYPEDDATA_V4', [statement, permit], signer)).toThrow(
        MalformedSignatureRequestError
      )
    })
  })

  describe('when the method is personal_sign', () => {
    describe('and the params are [message, signer]', () => {
      it('should not throw', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', ['hello', signer], signer)).not.toThrow()
      })
    })

    describe('and the message is larger than the review can take', () => {
      let oversized: string

      beforeEach(() => {
        oversized = 'x'.repeat(96 * 1024 + 1)
      })

      it('should throw a MalformedSignatureRequestError naming the size', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', [oversized, signer], signer)).toThrow('too large to review')
      })
    })

    describe('and the params are [signer, message]', () => {
      it('should throw a MalformedSignatureRequestError because wallets sign the first param', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', [signer, 'hello'], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the message is hex and the signer is sent in lowercase', () => {
      it('should not throw because addresses compare case-insensitively', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', ['0x68656c6c6f', signer.toLowerCase()], signer)).not.toThrow()
      })
    })

    describe('and the signer is not among the params', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        const other = '0x0000000000000000000000000000000000000002'
        expect(() => assertSignatureParamsAreCanonical('personal_sign', ['hello', other], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and both params are the signer address', () => {
      it('should throw a MalformedSignatureRequestError because the message cannot be told apart', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', [signer, signer], signer)).toThrow(MalformedSignatureRequestError)
      })
    })

    describe('and the message is not a string', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', [{ text: 'hello' }, signer], signer)).toThrow(
          MalformedSignatureRequestError
        )
      })
    })

    describe('and there is a single param', () => {
      it('should throw a MalformedSignatureRequestError', () => {
        expect(() => assertSignatureParamsAreCanonical('personal_sign', ['hello'], signer)).toThrow(MalformedSignatureRequestError)
      })
    })
  })

  describe('when the method is eth_sendTransaction', () => {
    it('should not throw for any params because the transaction path builds its own canonical params', () => {
      expect(() => assertSignatureParamsAreCanonical('eth_sendTransaction', [{ to: '0x1', data: '0x' }, 'extra'], signer)).not.toThrow()
    })

    it('should not throw for a request without params', () => {
      expect(() => assertSignatureParamsAreCanonical('eth_sendTransaction', undefined, signer)).not.toThrow()
    })
  })
})

describe('assertTransactionParamsAreCanonical', () => {
  const to = '0xfef5c99885c3036e591b6e6db52482891834a5f4'
  const method = 'eth_sendTransaction'

  describe('when the params are a single transaction with an address, hex calldata and a hex value', () => {
    it('should not throw', () => {
      expect(() => assertTransactionParamsAreCanonical(method, [{ to, data: '0xa9059cbb', value: '0x0' }])).not.toThrow()
    })
  })

  describe('when the transaction omits data and value', () => {
    it('should not throw because both default downstream', () => {
      expect(() => assertTransactionParamsAreCanonical(method, [{ to }])).not.toThrow()
    })
  })

  describe('when the value is a decimal quantity', () => {
    it('should not throw', () => {
      expect(() => assertTransactionParamsAreCanonical(method, [{ to, value: '1000' }])).not.toThrow()
    })
  })

  describe('when the transaction carries fields the wallet is left to fill in', () => {
    it('should not throw because gas, nonce and chainId are dropped at dispatch', () => {
      expect(() =>
        assertTransactionParamsAreCanonical(method, [{ to, data: '0x', gas: '0x5208', nonce: '0x1', chainId: '0x89' }])
      ).not.toThrow()
    })
  })

  describe('when the method casing differs', () => {
    it('should still validate the transaction', () => {
      expect(() => assertTransactionParamsAreCanonical('ETH_SENDTRANSACTION', [{ to: 'not-an-address' }])).toThrow(
        MalformedTransactionRequestError
      )
    })
  })

  describe('when the method is not eth_sendTransaction', () => {
    it('should not throw for any params', () => {
      expect(() => assertTransactionParamsAreCanonical('personal_sign', ['hello', to])).not.toThrow()
    })
  })

  describe.each([
    ['there are no params', undefined],
    ['there are two params', [{ to }, { to }]],
    ['the param is a string', ['0xabcd']],
    ['the param is an array', [[to]]],
    ['calldata is carried in extraCallData', [{ to, data: '0x', extraCallData: '0xa9059cbb' }]],
    ['calldata is carried in input', [{ to, input: '0xa9059cbb' }]],
    ['to is missing', [{ data: '0x' }]],
    ['to is not an address', [{ to: 'attacker.eth' }]],
    ['data is not a string', [{ to, data: { hidden: true } }]],
    ['data is odd-length hex', [{ to, data: '0xabc' }]],
    ['data is not hex', [{ to, data: '0xzz' }]],
    ['data exceeds the preview limit', [{ to, data: `0x${'ab'.repeat(96 * 1024 + 1)}` }]],
    ['value is a number', [{ to, value: 1 }]],
    ['value is not a quantity', [{ to, value: '1 MANA' }]]
  ])('when %s', (_label, params) => {
    it('should throw a MalformedTransactionRequestError', () => {
      expect(() => assertTransactionParamsAreCanonical(method, params as unknown[] | undefined)).toThrow(MalformedTransactionRequestError)
    })
  })

  describe('when data is exactly at the calldata limit', () => {
    const largestAcceptedData = `0x${'ab'.repeat(96 * 1024)}`

    it('should not throw', () => {
      expect(() => assertTransactionParamsAreCanonical(method, [{ to, data: largestAcceptedData }])).not.toThrow()
    })
  })
})
