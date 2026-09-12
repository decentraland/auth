import { waitFor } from '@testing-library/react'
import { WalletConnectV2Connector, connection, getConfiguration } from 'decentraland-connect'
import { ConnectionOptionType, SignInOptionsMode } from '../../Connection/Connection.types'
import { FeatureFlagsKeys, SignInPrimaryOptionVariant } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import type { FeatureFlagsVariants } from '../../FeatureFlagsProvider/FeatureFlagsProvider.types'
import { connectToProvider, connectToSocialProvider, getSignInOptionsMode } from './utils'

jest.mock('decentraland-connect', () => ({
  connection: { connect: jest.fn(), disconnect: jest.fn() },
  getConfiguration: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors the exported class name
  WalletConnectV2Connector: { clearStorage: jest.fn() }
}))

// eslint-disable-next-line @typescript-eslint/unbound-method -- connection is fully mocked; connect is a jest.fn with no `this` binding
const mockConnect = connection.connect as jest.Mock
const mockClearStorage = WalletConnectV2Connector.clearStorage as jest.Mock

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

    it('should clear the stored WalletConnect session so the wallet chooser is always prompted', async () => {
      await connectToProvider(ConnectionOptionType.WALLET_CONNECT)

      expect(mockClearStorage).toHaveBeenCalled()
    })

    it('should clear the stored session before connecting, so the session cannot be reused', async () => {
      await connectToProvider(ConnectionOptionType.WALLET_CONNECT)

      expect(mockClearStorage.mock.invocationCallOrder[0]).toBeLessThan(mockConnect.mock.invocationCallOrder[0])
    })

    it('should clear the stored session again on a subsequent connect, so a second click re-prompts', async () => {
      await connectToProvider(ConnectionOptionType.WALLET_CONNECT)
      await connectToProvider(ConnectionOptionType.WALLET_CONNECT)

      expect(mockClearStorage).toHaveBeenCalledTimes(2)
    })
  })

  describe('when connecting to MetaMask Mobile', () => {
    beforeEach(() => {
      mockConnect.mockResolvedValue({ account: '0xabc', provider: {} })
    })

    it('should clear the stored WalletConnect session, since it also pairs over WalletConnect', async () => {
      await connectToProvider(ConnectionOptionType.METAMASK_MOBILE)

      expect(mockClearStorage).toHaveBeenCalled()
    })
  })

  describe('when connecting to a provider that does not use WalletConnect', () => {
    beforeEach(() => {
      mockConnect.mockResolvedValue({ account: '0xabc', provider: {} })
    })

    it('should not clear the stored WalletConnect session', async () => {
      await connectToProvider(ConnectionOptionType.COINBASE)

      expect(mockClearStorage).not.toHaveBeenCalled()
    })
  })
})

let mockMagic: { user: { isLoggedIn: jest.Mock; logout: jest.Mock }; oauth2: { loginWithRedirect: jest.Mock } }

jest.mock('magic-sdk', () => ({ Magic: jest.fn() }))
// eslint-disable-next-line @typescript-eslint/naming-convention
jest.mock('@magic-ext/oauth2', () => ({ OAuthExtension: jest.fn() }))

describe('when preparing a cancellable social login', () => {
  let controller: AbortController
  let resolveSession: (loggedIn: boolean) => void
  let pending: Promise<void>

  beforeEach(async () => {
    controller = new AbortController()
    mockMagic = { user: { isLoggedIn: jest.fn(), logout: jest.fn() }, oauth2: { loginWithRedirect: jest.fn() } }
    jest.requireMock('magic-sdk').Magic.mockImplementation(() => mockMagic)
    jest.mocked(getConfiguration).mockReturnValue({ magic: { apiKey: 'test-key' } } as ReturnType<typeof getConfiguration>)
    mockMagic.user.isLoggedIn.mockReturnValueOnce(
      new Promise(resolve => {
        resolveSession = resolve
      })
    )
    pending = connectToSocialProvider(ConnectionOptionType.GOOGLE, false, undefined, undefined, controller.signal)
    await waitFor(() => expect(mockMagic.user.isLoggedIn).toHaveBeenCalled())
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the user cancels during the session check', () => {
    beforeEach(() => {
      controller.abort()
    })

    it('should not log out or redirect after the session check resolves', async () => {
      resolveSession(true)
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      expect(mockMagic.user.logout).not.toHaveBeenCalled()
      expect(mockMagic.oauth2.loginWithRedirect).not.toHaveBeenCalled()
    })
  })

  describe('and the login remains active', () => {
    it('should start the selected OAuth flow', async () => {
      resolveSession(false)
      await pending
      expect(mockMagic.oauth2.loginWithRedirect).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google' }))
    })
  })
})
