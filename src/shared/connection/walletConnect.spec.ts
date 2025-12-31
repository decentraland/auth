import { connection } from 'decentraland-connect'
import { clearWalletConnectStorage, isWalletConnectStaleSessionError, resetWalletConnectConnection } from './walletConnect'

// Rationale: these helpers are part of our "self-healing" strategy for WalletConnect stale sessions.
// We keep the behavior narrowly-scoped (only WC keys) to avoid deleting unrelated localStorage state.
jest.mock('decentraland-connect', () => ({
  connection: {
    disconnect: jest.fn()
  }
}))

describe('walletConnect', () => {
  afterEach(() => {
    jest.resetAllMocks()
    localStorage.clear()
  })

  describe('when checking if an error is a stale WalletConnect session error', () => {
    describe('and the error is a string containing a stale session message', () => {
      let error: string

      beforeEach(() => {
        error = "No matching key. session topic doesn't exist: 123"
      })

      it('should return true', () => {
        expect(isWalletConnectStaleSessionError(error)).toBe(true)
      })
    })

    describe('and the error is an Error containing a stale session message', () => {
      let error: Error

      beforeEach(() => {
        error = new Error('Pending session not found for topic 0xabc')
      })

      it('should return true', () => {
        expect(isWalletConnectStaleSessionError(error)).toBe(true)
      })
    })

    describe('and the error does not match a stale session message', () => {
      let error: Error

      beforeEach(() => {
        error = new Error('Some other error')
      })

      it('should return false', () => {
        expect(isWalletConnectStaleSessionError(error)).toBe(false)
      })
    })
  })

  describe('when clearing WalletConnect keys from localStorage', () => {
    beforeEach(() => {
      localStorage.setItem('wc@2:clientId', 'x')
      localStorage.setItem('WALLETCONNECT_DEEPLINK_CHOICE', 'x')
      localStorage.setItem('unrelated', 'y')
    })

    it('should remove only the WalletConnect-related keys', () => {
      clearWalletConnectStorage()

      expect(localStorage.getItem('wc@2:clientId')).toBeNull()
      expect(localStorage.getItem('WALLETCONNECT_DEEPLINK_CHOICE')).toBeNull()
      expect(localStorage.getItem('unrelated')).toBe('y')
    })
  })

  describe('when resetting the WalletConnect connection', () => {
    let disconnect: jest.Mock

    beforeEach(() => {
      // Rationale: avoid referencing an unbound method (which could lose `this` in real implementations).
      // In this test, `connection.disconnect` is a jest.fn(), so we cast the module to a plain mock object.
      const mockedConnection = connection as unknown as { disconnect: jest.Mock }

      disconnect = mockedConnection.disconnect
      disconnect.mockResolvedValue(undefined)
      localStorage.setItem('wc@2:clientId', 'x')
      localStorage.setItem('unrelated', 'y')
    })

    it('should disconnect and clear WalletConnect-related storage keys', async () => {
      await resetWalletConnectConnection()

      expect(disconnect).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('wc@2:clientId')).toBeNull()
      expect(localStorage.getItem('unrelated')).toBe('y')
    })

    describe('and disconnect throws', () => {
      beforeEach(() => {
        disconnect.mockRejectedValueOnce(new Error('disconnect failed'))
      })

      it('should still clear WalletConnect-related storage keys', async () => {
        await expect(resetWalletConnectConnection()).resolves.toBeUndefined()

        expect(localStorage.getItem('wc@2:clientId')).toBeNull()
      })
    })
  })
})
