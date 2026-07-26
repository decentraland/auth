import { connection } from 'decentraland-connect'
import { ConnectionOptionType, SignInOptionsMode } from '../../Connection/Connection.types'
import { FeatureFlagsKeys, SignInPrimaryOptionVariant } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import type { FeatureFlagsVariants } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import { connectToProvider, getSignInOptionsMode } from './utils'

jest.mock('decentraland-connect', () => ({
  connection: { connect: jest.fn() },
  getConfiguration: jest.fn()
}))

// eslint-disable-next-line @typescript-eslint/unbound-method -- connection is fully mocked; connect is a jest.fn with no `this` binding
const mockConnect = connection.connect as jest.Mock

afterEach(() => {
  jest.clearAllMocks()
})

describe('getSignInOptionsMode', () => {
  let variants: Partial<FeatureFlagsVariants>

  beforeEach(() => {
    variants = {}
  })

  describe('when feature flag does not exist', () => {
    it('should return FULL mode', () => {
      const result = getSignInOptionsMode(variants)

      expect(result).toBe(SignInOptionsMode.FULL)
    })
  })

  describe('when feature flag is not enabled', () => {
    it('should return FULL mode', () => {
      const result = getSignInOptionsMode(variants)

      expect(result).toBe(SignInOptionsMode.FULL)
    })
  })

  describe('when feature flag is enabled', () => {
    describe('and variant is TWO_OPTIONS', () => {
      beforeEach(() => {
        variants[FeatureFlagsKeys.SIGN_IN_PRIMARY_OPTION] = {
          enabled: true,
          name: SignInPrimaryOptionVariant.TWO_OPTIONS
        }
      })

      it('should return TWO mode', () => {
        const result = getSignInOptionsMode(variants)

        expect(result).toBe(SignInOptionsMode.TWO)
      })
    })

    describe('and variant is ONE_OPTION', () => {
      beforeEach(() => {
        variants[FeatureFlagsKeys.SIGN_IN_PRIMARY_OPTION] = {
          enabled: true,
          name: SignInPrimaryOptionVariant.ONE_OPTION
        }
      })

      it('should return ONE mode', () => {
        const result = getSignInOptionsMode(variants)

        expect(result).toBe(SignInOptionsMode.ONE)
      })
    })
  })
})

describe('connectToProvider', () => {
  describe('when two connects for the same provider run concurrently', () => {
    let resolveConnect: (value: { account: string; provider: object }) => void

    beforeEach(() => {
      mockConnect.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveConnect = resolve
          })
      )
    })

    it('should call connection.connect only once, sharing the in-flight attempt', async () => {
      const first = connectToProvider(ConnectionOptionType.WALLET_CONNECT)
      const second = connectToProvider(ConnectionOptionType.WALLET_CONNECT)

      resolveConnect({ account: '0xabc', provider: {} })
      await Promise.all([first, second])

      expect(mockConnect).toHaveBeenCalledTimes(1)
    })

    it('should resolve both callers with the same connection data', async () => {
      const first = connectToProvider(ConnectionOptionType.WALLET_CONNECT)
      const second = connectToProvider(ConnectionOptionType.WALLET_CONNECT)

      resolveConnect({ account: '0xabc', provider: {} })
      const [firstResult, secondResult] = await Promise.all([first, second])

      expect(firstResult).toBe(secondResult)
    })
  })

  describe('when connecting to WalletConnect', () => {
    let removeItemSpy: jest.SpyInstance

    beforeEach(() => {
      removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem')
      mockConnect.mockResolvedValue({ account: '0xabc', provider: {} })
    })

    afterEach(() => {
      removeItemSpy.mockRestore()
    })

    it('should clear the legacy WalletConnect deep-link choice', async () => {
      await connectToProvider(ConnectionOptionType.WALLET_CONNECT)

      expect(removeItemSpy).toHaveBeenCalledWith('WALLETCONNECT_DEEPLINK_CHOICE')
    })
  })
})
