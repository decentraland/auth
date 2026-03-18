import { renderHook } from '@testing-library/react'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity } from '@dcl/crypto'
import { isProfileComplete } from '../shared/profile'
import { useEnsureProfile } from './useEnsureProfile'

jest.mock('../shared/profile')

jest.mock('../modules/config', () => ({
  config: { get: jest.fn().mockReturnValue('10000') }
}))

const mockCreateFetcher = jest.fn().mockReturnValue({ fetch: jest.fn() })
jest.mock('../shared/fetcher', () => ({
  createFetcher: (...args: unknown[]) => mockCreateFetcher(...args)
}))

const mockCheckProfileConsistency = jest.fn()
jest.mock('./useProfileConsistency', () => ({
  useProfileConsistency: () => ({ checkProfileConsistency: mockCheckProfileConsistency })
}))

const mockNavigateToSetup = jest.fn()
jest.mock('./useSetupNavigation', () => ({
  useSetupNavigation: () => ({ navigateToSetup: mockNavigateToSetup })
}))

describe('useEnsureProfile', () => {
  let account: string
  let identity: AuthIdentity
  let options: { redirectTo: string; referrer: string | null }

  beforeEach(() => {
    account = '0xabc123'
    identity = { ephemeralIdentity: {}, expiration: new Date(), authChain: [] } as unknown as AuthIdentity
    options = { redirectTo: 'https://decentraland.org', referrer: 'https://referrer.com' }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when calling ensureProfile', () => {
    describe('and the profile is complete', () => {
      let mockProfile: Profile

      beforeEach(() => {
        mockProfile = { avatars: [{ name: 'User' }] } as unknown as Profile
        mockCheckProfileConsistency.mockResolvedValueOnce({ profile: mockProfile, isConsistent: true })
        jest.mocked(isProfileComplete).mockReturnValueOnce(true)
      })

      it('should return the profile', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        const profile = await result.current.ensureProfile(account, identity, options)
        expect(profile).toBe(mockProfile)
      })

      it('should not navigate to setup', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        await result.current.ensureProfile(account, identity, options)
        expect(mockNavigateToSetup).not.toHaveBeenCalled()
      })
    })

    describe('and the profile is incomplete', () => {
      beforeEach(() => {
        mockCheckProfileConsistency.mockResolvedValueOnce({ profile: { avatars: [{}] }, isConsistent: true })
        jest.mocked(isProfileComplete).mockReturnValueOnce(false)
      })

      it('should navigate to setup', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        await result.current.ensureProfile(account, identity, options)
        expect(mockNavigateToSetup).toHaveBeenCalledWith(options.redirectTo, options.referrer, undefined)
      })

      it('should return null', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        const profile = await result.current.ensureProfile(account, identity, options)
        expect(profile).toBeNull()
      })
    })

    describe('and no profile exists', () => {
      beforeEach(() => {
        mockCheckProfileConsistency.mockResolvedValueOnce({ profile: undefined, isConsistent: true })
      })

      it('should navigate to setup', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        await result.current.ensureProfile(account, identity, options)
        expect(mockNavigateToSetup).toHaveBeenCalled()
      })

      it('should return null', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        const profile = await result.current.ensureProfile(account, identity, options)
        expect(profile).toBeNull()
      })
    })

    describe('and navigate options are provided', () => {
      beforeEach(() => {
        mockCheckProfileConsistency.mockResolvedValueOnce({ profile: undefined, isConsistent: true })
      })

      it('should pass navigate options through', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        await result.current.ensureProfile(account, identity, {
          ...options,
          navigateOptions: { replace: true }
        })
        expect(mockNavigateToSetup).toHaveBeenCalledWith(options.redirectTo, options.referrer, { replace: true })
      })
    })

    describe('when creating the fetcher', () => {
      beforeEach(() => {
        mockCheckProfileConsistency.mockResolvedValueOnce({ profile: { avatars: [{ name: 'User' }] }, isConsistent: true })
        jest.mocked(isProfileComplete).mockReturnValueOnce(true)
      })

      it('should create a fetcher with a timeout', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        await result.current.ensureProfile(account, identity, options)
        expect(mockCreateFetcher).toHaveBeenCalledWith(expect.objectContaining({ timeout: expect.any(Number) }))
      })

      it('should pass the fetcher to checkProfileConsistency', async () => {
        const { result } = renderHook(() => useEnsureProfile())
        await result.current.ensureProfile(account, identity, options)
        expect(mockCheckProfileConsistency).toHaveBeenCalledWith(account, identity, expect.any(Object))
      })
    })
  })
})
