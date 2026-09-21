import { canRelayPersonalSign, getApprovedEip155Methods, hasLiveWalletConnectSession, isMissingSessionError } from './walletConnect'

const buildSession = (namespaces: Record<string, { methods?: unknown }>) => ({ namespaces })

describe('getApprovedEip155Methods', () => {
  describe('when the provider is not a WalletConnect one', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { request: jest.fn() }
    })

    it('should return undefined so callers treat the wallet as capable', () => {
      expect(getApprovedEip155Methods(provider)).toBeUndefined()
    })
  })

  describe('when the session is exposed directly on the provider', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { session: buildSession({ eip155: { methods: ['personal_sign', 'eth_sendTransaction'] } }) }
    })

    it('should return the methods approved for the eip155 namespace', () => {
      expect(getApprovedEip155Methods(provider)).toEqual(['personal_sign', 'eth_sendTransaction'])
    })
  })

  describe('and the session is only reachable through the signer', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { signer: { session: buildSession({ eip155: { methods: ['personal_sign'] } }) } }
    })

    it('should return the methods approved for the eip155 namespace', () => {
      expect(getApprovedEip155Methods(provider)).toEqual(['personal_sign'])
    })
  })

  describe('and the namespaces are keyed by chain instead of by namespace', () => {
    let provider: unknown

    beforeEach(() => {
      provider = {
        session: buildSession({
          /* eslint-disable @typescript-eslint/naming-convention -- CAIP-2 chain ids, not identifiers */
          'eip155:1': { methods: ['personal_sign'] },
          'eip155:137': { methods: ['eth_sendTransaction', 'personal_sign'] },
          /* eslint-enable @typescript-eslint/naming-convention */
          solana: { methods: ['solana_signMessage'] }
        })
      }
    })

    it('should merge the eip155 chains and leave other namespaces out', () => {
      expect(getApprovedEip155Methods(provider)).toEqual(['personal_sign', 'eth_sendTransaction'])
    })
  })

  describe('and the eip155 namespace was approved without any method', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { session: buildSession({ eip155: { methods: [] } }) }
    })

    it('should return undefined rather than an empty list', () => {
      expect(getApprovedEip155Methods(provider)).toBeUndefined()
    })
  })
})

describe('canRelayPersonalSign', () => {
  describe('when the approved session includes personal_sign', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { session: buildSession({ eip155: { methods: ['eth_sendTransaction', 'personal_sign'] } }) }
    })

    it('should report that the signature request will reach the wallet', () => {
      expect(canRelayPersonalSign(provider)).toBe(true)
    })
  })

  describe('when the approved session leaves personal_sign out', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { session: buildSession({ eip155: { methods: ['eth_sendTransaction', 'eth_signTypedData_v4'] } }) }
    })

    it('should report that the signature request would never reach the wallet', () => {
      expect(canRelayPersonalSign(provider)).toBe(false)
    })
  })

  describe('when the provider does not expose a readable session', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { request: jest.fn() }
    })

    it('should fail open and report the wallet as capable', () => {
      expect(canRelayPersonalSign(provider)).toBe(true)
    })
  })
})

describe('isMissingSessionError', () => {
  describe('when the provider states it has no session', () => {
    it('should match the message UniversalProvider guards every request with', () => {
      expect(isMissingSessionError(new Error('Please call connect() before request()'))).toBe(true)
    })
  })

  describe('when the failure is anything else', () => {
    it('should not match another stale-session message', () => {
      expect(isMissingSessionError(new Error("session topic doesn't exist: abc"))).toBe(false)
    })

    it('should not match a non-Error value carrying the same text', () => {
      expect(isMissingSessionError('Please call connect() before request()')).toBe(false)
    })
  })
})

describe('hasLiveWalletConnectSession', () => {
  describe('when the provider answers the probe', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { request: jest.fn().mockResolvedValue('0x1') }
    })

    it('should report the session as usable', async () => {
      await expect(hasLiveWalletConnectSession(provider)).resolves.toBe(true)
    })
  })

  describe('when the provider reports it has no session', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { request: jest.fn().mockRejectedValue(new Error('Please call connect() before request()')) }
    })

    it('should report the session as unusable, so the caller can re-pair instead of signing', async () => {
      await expect(hasLiveWalletConnectSession(provider)).resolves.toBe(false)
    })
  })

  describe('when the probe fails for an unrelated reason', () => {
    let provider: unknown

    beforeEach(() => {
      provider = { request: jest.fn().mockRejectedValue(new Error('Network request failed')) }
    })

    it('should fail open and keep the connection', async () => {
      await expect(hasLiveWalletConnectSession(provider)).resolves.toBe(true)
    })
  })

  describe('when the provider cannot be probed at all', () => {
    it('should fail open and keep the connection', async () => {
      await expect(hasLiveWalletConnectSession(undefined)).resolves.toBe(true)
    })
  })
})
