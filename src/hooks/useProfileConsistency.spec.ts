/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook } from '@testing-library/react'
import { IFetchComponent } from '@well-known-components/interfaces'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity } from '@dcl/crypto'
import { fetchProfileWithConsistencyCheck, redeployExistingProfile, redeployExistingProfileWithContentServerData } from '../modules/profile'
import { useProfileConsistency } from './useProfileConsistency'

jest.mock('../modules/profile')

// --- Disabled Catalysts ---
const mockDisabledCatalysts = ['https://disabled.catalyst.org']
jest.mock('./useDisabledCatalysts', () => ({
  useDisabledCatalysts: () => mockDisabledCatalysts
}))

describe('useProfileConsistency', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when calling checkProfileConsistency', () => {
    let account: string
    let identity: AuthIdentity

    beforeEach(() => {
      account = '0xabc123'
      identity = { ephemeralIdentity: {}, expiration: new Date(), authChain: [] } as unknown as AuthIdentity
    })

    describe('and the profile is consistent', () => {
      let mockProfile: Profile

      beforeEach(() => {
        mockProfile = { avatars: [{ name: 'User' }] } as unknown as Profile
        jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
          profile: mockProfile,
          isConsistent: true
        })
      })

      it('should return the profile and consistent status', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        const outcome = await result.current.checkProfileConsistency(account, identity)
        expect(outcome).toEqual({ profile: mockProfile, isConsistent: true })
      })

      it('should not attempt to redeploy', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        await result.current.checkProfileConsistency(account, identity)
        expect(redeployExistingProfile).not.toHaveBeenCalled()
      })
    })

    describe('and the profile is inconsistent with identity available', () => {
      let mockProfile: Profile

      beforeEach(() => {
        mockProfile = { avatars: [{ name: 'User' }] } as unknown as Profile
        jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
          profile: mockProfile,
          isConsistent: false
        })
        jest.mocked(redeployExistingProfile).mockResolvedValueOnce(undefined as any)
      })

      it('should attempt to redeploy the profile', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        await result.current.checkProfileConsistency(account, identity)
        expect(redeployExistingProfile).toHaveBeenCalledWith(mockProfile, account, identity, mockDisabledCatalysts)
      })

      it('should return the profile with inconsistent status', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        const outcome = await result.current.checkProfileConsistency(account, identity)
        expect(outcome).toEqual({ profile: mockProfile, isConsistent: false })
      })
    })

    describe('and the profile is inconsistent without identity', () => {
      let mockProfile: Profile

      beforeEach(() => {
        mockProfile = { avatars: [{ name: 'User' }] } as unknown as Profile
        jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
          profile: mockProfile,
          isConsistent: false
        })
      })

      it('should not attempt to redeploy', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        await result.current.checkProfileConsistency(account, null)
        expect(redeployExistingProfile).not.toHaveBeenCalled()
      })
    })

    describe('and redeployment fails', () => {
      let mockProfile: Profile

      beforeEach(() => {
        mockProfile = { avatars: [{ name: 'User' }] } as unknown as Profile
        jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
          profile: mockProfile,
          isConsistent: false
        })
        jest.mocked(redeployExistingProfile).mockRejectedValueOnce(new Error('Deploy failed'))
      })

      describe('and the profile was fetched from a specific catalyst', () => {
        beforeEach(() => {
          jest.mocked(fetchProfileWithConsistencyCheck).mockReset()
          jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
            profile: mockProfile,
            isConsistent: false,
            profileFetchedFrom: 'https://catalyst.example.com'
          })
          jest.mocked(redeployExistingProfile).mockReset()
          jest.mocked(redeployExistingProfile).mockRejectedValueOnce(new Error('Deploy failed'))
          jest.mocked(redeployExistingProfileWithContentServerData).mockResolvedValueOnce(undefined as any)
        })

        it('should fallback to redeploying with content server data', async () => {
          const { result } = renderHook(() => useProfileConsistency())
          await result.current.checkProfileConsistency(account, identity)
          expect(redeployExistingProfileWithContentServerData).toHaveBeenCalledWith(
            'https://catalyst.example.com',
            account,
            identity,
            mockDisabledCatalysts
          )
        })
      })

      describe('and the profile was not fetched from a specific catalyst', () => {
        it('should not attempt content server fallback', async () => {
          const { result } = renderHook(() => useProfileConsistency())
          await result.current.checkProfileConsistency(account, identity)
          expect(redeployExistingProfileWithContentServerData).not.toHaveBeenCalled()
        })

        it('should still return the profile', async () => {
          const { result } = renderHook(() => useProfileConsistency())
          const outcome = await result.current.checkProfileConsistency(account, identity)
          expect(outcome).toEqual({ profile: mockProfile, isConsistent: false })
        })
      })

      describe('and the content server fallback also fails', () => {
        beforeEach(() => {
          jest.mocked(fetchProfileWithConsistencyCheck).mockReset()
          jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
            profile: mockProfile,
            isConsistent: false,
            profileFetchedFrom: 'https://catalyst.example.com'
          })
          jest.mocked(redeployExistingProfile).mockReset()
          jest.mocked(redeployExistingProfile).mockRejectedValueOnce(new Error('Deploy failed'))
          jest.mocked(redeployExistingProfileWithContentServerData).mockRejectedValueOnce(new Error('Content server deploy also failed'))
        })

        it('should still return the profile without throwing', async () => {
          const { result } = renderHook(() => useProfileConsistency())
          const outcome = await result.current.checkProfileConsistency(account, identity)
          expect(outcome).toEqual({ profile: mockProfile, isConsistent: false })
        })
      })
    })

    describe('and no profile exists', () => {
      beforeEach(() => {
        jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
          profile: undefined,
          isConsistent: true
        })
      })

      it('should return undefined profile without attempting redeployment', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        const outcome = await result.current.checkProfileConsistency(account, identity)
        expect(outcome).toEqual({ profile: undefined, isConsistent: true })
        expect(redeployExistingProfile).not.toHaveBeenCalled()
      })
    })

    describe('and a custom fetcher is provided', () => {
      let mockFetcher: IFetchComponent

      beforeEach(() => {
        mockFetcher = { fetch: jest.fn() } as unknown as IFetchComponent
        jest.mocked(fetchProfileWithConsistencyCheck).mockResolvedValueOnce({
          profile: { avatars: [] } as unknown as Profile,
          isConsistent: true
        })
      })

      it('should pass the fetcher to fetchProfileWithConsistencyCheck', async () => {
        const { result } = renderHook(() => useProfileConsistency())
        await result.current.checkProfileConsistency(account, identity, mockFetcher)
        expect(fetchProfileWithConsistencyCheck).toHaveBeenCalledWith(account, mockDisabledCatalysts, mockFetcher)
      })
    })
  })
})
