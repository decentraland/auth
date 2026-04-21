import { ProviderType } from '@dcl/schemas'
import { isSessionMismatch } from './useSessionMismatch'

describe('isSessionMismatch', () => {
  describe('when loginMethod is null', () => {
    it('should return false regardless of provider type', () => {
      expect(isSessionMismatch(ProviderType.MAGIC, null)).toBe(false)
      expect(isSessionMismatch(ProviderType.INJECTED, null)).toBe(false)
    })
  })

  describe('when providerType is undefined', () => {
    it('should return false regardless of login method', () => {
      expect(isSessionMismatch(undefined, 'METAMASK')).toBe(false)
      expect(isSessionMismatch(undefined, 'GOOGLE')).toBe(false)
    })
  })

  describe('social session + wallet loginMethod → mismatch', () => {
    it('should detect mismatch for MAGIC + METAMASK', () => {
      expect(isSessionMismatch(ProviderType.MAGIC, 'METAMASK')).toBe(true)
      expect(isSessionMismatch(ProviderType.MAGIC, 'metamask')).toBe(true)
    })

    it('should detect mismatch for MAGIC_TEST + METAMASK', () => {
      expect(isSessionMismatch(ProviderType.MAGIC_TEST, 'METAMASK')).toBe(true)
    })

    it('should detect mismatch for THIRDWEB + METAMASK', () => {
      expect(isSessionMismatch(ProviderType.THIRDWEB, 'METAMASK')).toBe(true)
    })

    it('should detect mismatch for social session + other wallet methods', () => {
      expect(isSessionMismatch(ProviderType.MAGIC, 'WALLETCONNECT')).toBe(true)
      expect(isSessionMismatch(ProviderType.THIRDWEB, 'COINBASE')).toBe(true)
      expect(isSessionMismatch(ProviderType.MAGIC, 'FORTMATIC')).toBe(true)
    })
  })

  describe('wallet session + social loginMethod → mismatch', () => {
    it('should detect mismatch for INJECTED + social methods', () => {
      expect(isSessionMismatch(ProviderType.INJECTED, 'GOOGLE')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'DISCORD')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'APPLE')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'X')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'EMAIL')).toBe(true)
    })
  })

  describe('matching session + loginMethod → no mismatch', () => {
    it('should return false for social session + social loginMethod', () => {
      expect(isSessionMismatch(ProviderType.MAGIC, 'GOOGLE')).toBe(false)
      expect(isSessionMismatch(ProviderType.MAGIC_TEST, 'DISCORD')).toBe(false)
      expect(isSessionMismatch(ProviderType.THIRDWEB, 'APPLE')).toBe(false)
      expect(isSessionMismatch(ProviderType.THIRDWEB, 'EMAIL')).toBe(false)
    })

    it('should return false for wallet session + wallet loginMethod', () => {
      expect(isSessionMismatch(ProviderType.INJECTED, 'METAMASK')).toBe(false)
      expect(isSessionMismatch(ProviderType.WALLET_CONNECT_V2, 'WALLETCONNECT')).toBe(false)
      expect(isSessionMismatch(ProviderType.WALLET_LINK, 'COINBASE')).toBe(false)
    })
  })
})
