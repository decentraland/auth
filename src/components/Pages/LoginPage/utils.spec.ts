import { ProviderType } from '@dcl/schemas/dist/dapps/provider-type'
import { connection } from 'decentraland-connect'
import { isWalletConnectStaleSessionError, resetWalletConnectConnection } from '../../../shared/connection/walletConnect'
import { ConnectionOptionType } from '../../Connection'
import { connectToProvider } from './utils'

// Rationale: WalletConnect has edge-cases around stale persisted sessions and "double init" warnings in dev.
// These tests ensure our connection helper resets WC only when needed and reuses in-memory connections when possible.
jest.mock('decentraland-connect', () => ({
  connection: {
    connect: jest.fn(),
    isConnected: jest.fn(),
    tryPreviousConnection: jest.fn()
  },
  getConfiguration: jest.fn()
}))

jest.mock('../../../shared/connection/walletConnect', () => ({
  isWalletConnectStaleSessionError: jest.fn(),
  resetWalletConnectConnection: jest.fn()
}))

describe('connectToProvider', () => {
  let mockConnect: jest.Mock
  let mockIsConnected: jest.Mock
  let mockTryPreviousConnection: jest.Mock
  let mockIsWalletConnectStaleSessionError: jest.Mock
  let mockResetWalletConnectConnection: jest.Mock

  afterEach(() => {
    jest.resetAllMocks()
  })

  beforeEach(() => {
    // Rationale: `decentraland-connect` exposes methods that are class-bound in production.
    // In tests we mock them with jest.fn(), so we cast to a plain object of mocks to avoid `unbound-method` lint errors.
    const mockedConnection = connection as unknown as {
      connect: jest.Mock
      isConnected: jest.Mock
      tryPreviousConnection: jest.Mock
    }

    mockConnect = mockedConnection.connect
    mockIsConnected = mockedConnection.isConnected
    mockTryPreviousConnection = mockedConnection.tryPreviousConnection
    mockIsWalletConnectStaleSessionError = isWalletConnectStaleSessionError as jest.Mock
    mockResetWalletConnectConnection = resetWalletConnectConnection as jest.Mock
  })

  describe('when connecting with WalletConnect and the connection succeeds', () => {
    let connectionData: { account: string; provider: Record<string, unknown> }
    let result: unknown

    beforeEach(async () => {
      connectionData = { account: '0x123', provider: {} }
      mockIsConnected.mockReturnValue(false)
      mockResetWalletConnectConnection.mockResolvedValue(undefined)
      mockIsWalletConnectStaleSessionError.mockReturnValue(false)
      mockConnect.mockResolvedValueOnce(connectionData)

      result = await connectToProvider(ConnectionOptionType.WALLET_CONNECT)
    })

    it('should connect using WALLET_CONNECT_V2', () => {
      expect(mockResetWalletConnectConnection).toHaveBeenCalledTimes(1)
      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(mockConnect).toHaveBeenCalledWith(ProviderType.WALLET_CONNECT_V2)
      expect(mockTryPreviousConnection).not.toHaveBeenCalled()
      expect(result).toEqual(connectionData)
    })
  })

  describe('when connecting with WalletConnect and a connection already exists in-memory', () => {
    let connectionData: { account: string; provider: Record<string, unknown> }
    let result: unknown

    beforeEach(async () => {
      connectionData = { account: '0x123', provider: {} }
      mockIsConnected.mockReturnValue(true)
      mockTryPreviousConnection.mockResolvedValue(connectionData)

      result = await connectToProvider(ConnectionOptionType.WALLET_CONNECT)
    })

    it('should reuse the previous connection without re-initializing WalletConnect', () => {
      expect(mockResetWalletConnectConnection).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
      expect(mockTryPreviousConnection).toHaveBeenCalledTimes(1)
      expect(result).toEqual(connectionData)
    })
  })

  describe('when connecting with an injected provider', () => {
    let connectionData: { account: string; provider: Record<string, unknown> }
    let result: unknown

    beforeEach(async () => {
      connectionData = { account: '0x123', provider: {} }
      mockIsConnected.mockReturnValue(false)
      mockResetWalletConnectConnection.mockResolvedValue(undefined)
      mockConnect.mockResolvedValueOnce(connectionData)

      result = await connectToProvider(ConnectionOptionType.METAMASK)
    })

    it('should not reset WalletConnect and connect using INJECTED', () => {
      expect(mockResetWalletConnectConnection).not.toHaveBeenCalled()
      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(mockConnect).toHaveBeenCalledWith(ProviderType.INJECTED)
      expect(mockTryPreviousConnection).not.toHaveBeenCalled()
      expect(result).toEqual(connectionData)
    })
  })
})
