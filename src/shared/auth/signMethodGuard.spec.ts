import { DOMAIN_TYPE, OFFCHAIN_META_TRANSACTION_TYPE } from 'decentraland-transactions'
import { ImpersonatedSignInError, MalformedSignatureRequestError, MalformedTransactionRequestError, UnsupportedMethodError } from './errors'
import { buildMetaTransactionSimulationPayload } from './metaTransactionSimulation'
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
          ]
        },
        message: { checks: { uses: 1, expiration: 1 }, sent: [], received: [] }
      })
    })

    it('should not throw because the MetaTransaction checks do not apply to other structs', () => {
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

      it('should throw a MalformedSignatureRequestError because the wallet would sign only the declared call', () => {
        expect(() =>
          assertSignatureParamsAreCanonical('eth_signTypedData_v4', [signerAddress, JSON.stringify(typedData)], signerAddress)
        ).toThrow(MalformedSignatureRequestError)
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

    it('should not throw when there are no params', () => {
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

  describe('when data is exactly at the preview limit', () => {
    // Mirrors SIMULATION `data` maxLength in auth-server's request schema (ports/server/validations.ts).
    const previewServerMaxDataCharacters = 200_000
    const largestAcceptedData = `0x${'ab'.repeat(96 * 1024)}`

    it('should not throw', () => {
      expect(() => assertTransactionParamsAreCanonical(method, [{ to, data: largestAcceptedData }])).not.toThrow()
    })

    it('should still fit the preview server limit once the meta-transaction sender is appended for a relayed call', () => {
      const relayed = buildMetaTransactionSimulationPayload(137, to, largestAcceptedData, '0xd9b96b5dc720fc52bede1ec3b40a930e15f70ddd')
      expect(String(relayed.data).length).toBeLessThanOrEqual(previewServerMaxDataCharacters)
    })
  })
})
