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

  describe('when session is social (MAGIC) and loginMethod is METAMASK', () => {
    it('should return true (mismatch)', () => {
      expect(isSessionMismatch(ProviderType.MAGIC, 'METAMASK')).toBe(true)
      expect(isSessionMismatch(ProviderType.MAGIC, 'metamask')).toBe(true)
    })
  })

  describe('when session is social (MAGIC_TEST) and loginMethod is METAMASK', () => {
    it('should return true (mismatch)', () => {
      expect(isSessionMismatch(ProviderType.MAGIC_TEST, 'METAMASK')).toBe(true)
    })
  })

  describe('when session is social (THIRDWEB) and loginMethod is METAMASK', () => {
    it('should return true (mismatch)', () => {
      expect(isSessionMismatch(ProviderType.THIRDWEB, 'METAMASK')).toBe(true)
    })
  })

  describe('when session is wallet (INJECTED) and loginMethod is social', () => {
    it('should return true (mismatch)', () => {
      expect(isSessionMismatch(ProviderType.INJECTED, 'GOOGLE')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'DISCORD')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'APPLE')).toBe(true)
      expect(isSessionMismatch(ProviderType.INJECTED, 'X')).toBe(true)
    })
  })

  describe('when session matches loginMethod', () => {
    it('should return false for social session + social loginMethod', () => {
      expect(isSessionMismatch(ProviderType.MAGIC, 'GOOGLE')).toBe(false)
      expect(isSessionMismatch(ProviderType.MAGIC_TEST, 'DISCORD')).toBe(false)
      expect(isSessionMismatch(ProviderType.THIRDWEB, 'APPLE')).toBe(false)
    })

    it('should return false for wallet session + wallet loginMethod', () => {
      expect(isSessionMismatch(ProviderType.INJECTED, 'METAMASK')).toBe(false)
    })
  })
})
