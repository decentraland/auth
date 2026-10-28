import { ProviderType } from '@dcl/schemas'
import { connection } from 'decentraland-connect'
import { getCurrentConnectionData } from './connection'

jest.mock('decentraland-connect', () => ({
  connection: { tryPreviousConnection: jest.fn() },
  getConfiguration: () => ({ storageKey: 'decentraland-connect-storage-key' })
}))

jest.mock('./identity', () => ({
  getCachedIdentity: jest.fn().mockReturnValue(undefined)
}))

// eslint-disable-next-line @typescript-eslint/unbound-method -- connection is fully mocked
const mockTryPreviousConnection = connection.tryPreviousConnection as jest.Mock

const storeProvider = (providerType: ProviderType) =>
  localStorage.setItem('decentraland-connect-storage-key', JSON.stringify({ providerType, chainId: 1 }))

describe('getCurrentConnectionData', () => {
  beforeEach(() => {
    localStorage.clear()
    mockTryPreviousConnection.mockResolvedValue({
      account: '0xabc',
      provider: {},
      providerType: ProviderType.WALLET_CONNECT_V2,
      chainId: 1
    })
  })

  afterEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  describe('when the last connection was WalletConnect and no session is left on disk', () => {
    beforeEach(() => {
      storeProvider(ProviderType.WALLET_CONNECT_V2)
      localStorage.setItem('wc@2:client:0.3//session', '[]')
    })

    it('should not reach the connector, since restoring would open the wallet chooser', async () => {
      await getCurrentConnectionData()

      expect(mockTryPreviousConnection).not.toHaveBeenCalled()
    })

    it('should report no connection', async () => {
      await expect(getCurrentConnectionData()).resolves.toBeNull()
    })
  })

  describe('when the last connection was WalletConnect and its session is still stored', () => {
    beforeEach(() => {
      storeProvider(ProviderType.WALLET_CONNECT_V2)
      localStorage.setItem('wc@2:client:0.3//session', '[{"topic":"abc"}]')
    })

    it('should restore it as before', async () => {
      await getCurrentConnectionData()

      expect(mockTryPreviousConnection).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the last connection was not WalletConnect', () => {
    beforeEach(() => {
      storeProvider(ProviderType.INJECTED)
    })

    it('should restore it without looking for a WalletConnect session', async () => {
      await getCurrentConnectionData()

      expect(mockTryPreviousConnection).toHaveBeenCalledTimes(1)
    })
  })

  describe('when nothing has been connected before', () => {
    it('should still ask the connector, which answers for every provider type', async () => {
      await getCurrentConnectionData()

      expect(mockTryPreviousConnection).toHaveBeenCalledTimes(1)
    })
  })

  describe('when the connector reports no account', () => {
    beforeEach(() => {
      storeProvider(ProviderType.INJECTED)
      mockTryPreviousConnection.mockResolvedValue({ account: undefined, provider: {}, providerType: ProviderType.INJECTED })
    })

    it('should report no connection', async () => {
      await expect(getCurrentConnectionData()).resolves.toBeNull()
    })
  })
})
