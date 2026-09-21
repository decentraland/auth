import { canRelayPersonalSign, getApprovedEip155Methods } from './walletConnect'

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
