import { DeploymentBuilder, createContentClient, createLambdasClient } from 'dcl-catalyst-client'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { Entity, EntityType } from '@dcl/schemas'
import {
  DEFAULT_MOCK_ADDRESS,
  createMockDeploymentResult,
  createMockEntity,
  createMockIdentity,
  createMockProfile
} from '../../tests/mocks/profile'
import { config } from '../config'
import { DeploymentError } from './errors'
import {
  fetchProfile,
  fetchProfileWithConsistencyCheck,
  fetchProfiles,
  redeployExistingProfile,
  redeployExistingProfileWithContentServerData
} from './index'

// Mock dependencies
jest.mock('dcl-catalyst-client', () => ({
  createLambdasClient: jest.fn(),
  createContentClient: jest.fn(),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  DeploymentBuilder: {
    buildEntity: jest.fn()
  }
}))

jest.mock('dcl-catalyst-client/dist/contracts-snapshots', () => ({
  getCatalystServersFromCache: jest.fn()
}))

jest.mock('@dcl/crypto', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Authenticator: {
    signPayload: jest.fn()
  }
}))

jest.mock('../config', () => ({
  config: {
    get: jest.fn()
  }
}))

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => undefined)
jest.spyOn(console, 'warn').mockImplementation(() => undefined)
jest.spyOn(console, 'error').mockImplementation(() => undefined)

const createCatalystList = (...addresses: string[]) => addresses.map(address => ({ address }))

const createMockResponse = (ok: boolean, status: number, body: string = '') =>
  ({
    ok,
    status,
    text: jest.fn().mockResolvedValue(body)
  }) as unknown as Response

const setupRedeployBase = (address: string = DEFAULT_MOCK_ADDRESS) => {
  const profile = createMockProfile(address)
  const identity = createMockIdentity(address)

  return { profile, identity }
}

describe('profile module', () => {
  beforeEach(() => {
    ;(config.get as jest.Mock).mockImplementation((key: string) => {
      const configMap = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ENVIRONMENT: 'development',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PEER_URL: 'https://peer.decentraland.zone'
      }
      return configMap[key as keyof typeof configMap] ?? null
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when checking profile consistency with fetchProfileWithConsistencyCheck', () => {
    const mockAddress = DEFAULT_MOCK_ADDRESS
    let result: Awaited<ReturnType<typeof fetchProfileWithConsistencyCheck>>
    let mockProfile: Partial<Profile>

    describe('and all catalysts return the same profile with the same timestamp', () => {
      beforeEach(async () => {
        mockProfile = {
          timestamp: 1000,
          avatars: []
        }

        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://catalyst2.zone' },
          { address: 'https://catalyst3.zone' }
        ]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)
        ;(createLambdasClient as jest.Mock).mockReturnValue({
          getAvatarDetails: jest.fn().mockResolvedValue(mockProfile)
        })

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as true', () => {
        expect(result.isConsistent).toBe(true)
      })

      it('should return the profile', () => {
        expect(result.profile).toEqual(mockProfile)
      })

      it('should return the profileFetchedFrom URL', () => {
        expect(result.profileFetchedFrom).toBeDefined()
      })
    })

    describe('and catalysts return profiles with different timestamps', () => {
      let newestProfile: Partial<Profile>

      beforeEach(async () => {
        const olderProfile: Partial<Profile> = { timestamp: 1000, avatars: [] }
        newestProfile = { timestamp: 2000, avatars: [] }

        const mockCatalysts = [{ address: 'https://catalyst1.zone' }, { address: 'https://catalyst2.zone' }]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockClient1 = { getAvatarDetails: jest.fn().mockResolvedValue(olderProfile) }
        const mockClient2 = { getAvatarDetails: jest.fn().mockResolvedValue(newestProfile) }

        ;(createLambdasClient as jest.Mock).mockReturnValueOnce(mockClient1).mockReturnValueOnce(mockClient2)

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return the newest profile', () => {
        expect(result.profile).toEqual(newestProfile)
      })
    })

    describe('and some catalysts throw while others return the profile', () => {
      beforeEach(async () => {
        mockProfile = { timestamp: 1000, avatars: [] }

        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://catalyst2.zone' },
          { address: 'https://catalyst3.zone' }
        ]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockClientWithProfile = { getAvatarDetails: jest.fn().mockResolvedValue(mockProfile) }
        const mockClientWithError = {
          getAvatarDetails: jest.fn().mockRejectedValue('Internal failure')
        }

        ;(createLambdasClient as jest.Mock)
          .mockReturnValueOnce(mockClientWithProfile)
          .mockReturnValueOnce(mockClientWithError)
          .mockReturnValueOnce(mockClientWithProfile)

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as true because thrown errors are not considered as inconsistencies', () => {
        expect(result.isConsistent).toBe(true)
      })

      it('should return the available profile', () => {
        expect(result.profile).toEqual(mockProfile)
      })
    })

    describe('and some catalysts return a server error response while others return the profile', () => {
      beforeEach(async () => {
        mockProfile = { timestamp: 1000, avatars: [] }

        const serverErrorResponse = { error: 'Internal Server Error', message: 'Something went wrong' }
        const mockCatalysts = [{ address: 'https://catalyst1.zone' }, { address: 'https://catalyst2.zone' }]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockClientWithProfile = { getAvatarDetails: jest.fn().mockResolvedValue(mockProfile) }
        const mockClientWithServerError = {
          getAvatarDetails: jest.fn().mockResolvedValue(serverErrorResponse)
        }

        ;(createLambdasClient as jest.Mock).mockReturnValueOnce(mockClientWithProfile).mockReturnValueOnce(mockClientWithServerError)

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as true because server errors are not considered as inconsistencies', () => {
        expect(result.isConsistent).toBe(true)
      })

      it('should return the available profile', () => {
        expect(result.profile).toEqual(mockProfile)
      })
    })

    describe('and some catalysts return a not found response while others return the profile', () => {
      beforeEach(async () => {
        mockProfile = { timestamp: 1000, avatars: [] }

        const notFoundResponse = { error: 'Not Found', message: 'Profile not found' }
        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://catalyst2.zone' },
          { address: 'https://catalyst3.zone' }
        ]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockClientWithProfile = { getAvatarDetails: jest.fn().mockResolvedValue(mockProfile) }
        const mockClientWithNotFound = {
          getAvatarDetails: jest.fn().mockResolvedValue(notFoundResponse)
        }

        ;(createLambdasClient as jest.Mock)
          .mockReturnValueOnce(mockClientWithProfile)
          .mockReturnValueOnce(mockClientWithNotFound)
          .mockReturnValueOnce(mockClientWithProfile)

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return the available profile', () => {
        expect(result.profile).toEqual(mockProfile)
      })
    })

    describe('and a catalyst returns a not found alongside another that has a server error', () => {
      beforeEach(async () => {
        mockProfile = { timestamp: 1000, avatars: [] }

        const notFoundResponse = { error: 'Not Found', message: 'Profile not found' }
        const serverErrorResponse = { error: 'Internal Server Error' }
        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://catalyst2.zone' },
          { address: 'https://catalyst3.zone' }
        ]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)
        ;(createLambdasClient as jest.Mock)
          .mockReturnValueOnce({ getAvatarDetails: jest.fn().mockResolvedValue(mockProfile) })
          .mockReturnValueOnce({ getAvatarDetails: jest.fn().mockResolvedValue(notFoundResponse) })
          .mockReturnValueOnce({ getAvatarDetails: jest.fn().mockResolvedValue(serverErrorResponse) })

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as false because of the not found response', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return the available profile', () => {
        expect(result.profile).toEqual(mockProfile)
      })
    })

    describe('and no catalysts have the profile', () => {
      beforeEach(async () => {
        const notFoundResponse = { error: 'Not Found', message: 'Profile not found' }
        const mockCatalysts = [{ address: 'https://catalyst1.zone' }, { address: 'https://catalyst2.zone' }]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)
        ;(createLambdasClient as jest.Mock).mockReturnValue({
          getAvatarDetails: jest.fn().mockResolvedValue(notFoundResponse)
        })

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return an error message', () => {
        expect(result.error).toBe('No profiles found')
      })

      it('should not return a profile', () => {
        expect(result.profile).toBeUndefined()
      })

      it('should not flag the result as indeterminate because the not-found was authoritative', () => {
        expect(result.couldNotDetermine).toBeFalsy()
      })
    })

    describe('and every catalyst fails transiently without any authoritative not-found response', () => {
      beforeEach(async () => {
        const mockCatalysts = [{ address: 'https://catalyst1.zone' }, { address: 'https://catalyst2.zone' }]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)
        ;(createLambdasClient as jest.Mock).mockReturnValue({
          getAvatarDetails: jest.fn().mockRejectedValue(new Error('network error'))
        })

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should flag the result as indeterminate rather than "no profile"', () => {
        expect(result.couldNotDetermine).toBe(true)
      })

      it('should not return a profile', () => {
        expect(result.profile).toBeUndefined()
      })
    })

    describe('and an unexpected error occurs', () => {
      let errorMessage: string

      beforeEach(async () => {
        errorMessage = 'Unexpected failure'
        ;(getCatalystServersFromCache as jest.Mock).mockImplementation(() => {
          throw new Error(errorMessage)
        })

        result = await fetchProfileWithConsistencyCheck(mockAddress, [])
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return the error message', () => {
        expect(result.error).toContain(errorMessage)
      })
    })
  })

  describe('when redeploying existing profile with redeployExistingProfile', () => {
    const mockAddress = DEFAULT_MOCK_ADDRESS
    let mockProfile: Profile
    let mockIdentity: AuthIdentity

    beforeEach(() => {
      ;({ profile: mockProfile, identity: mockIdentity } = setupRedeployBase(mockAddress))
      ;(DeploymentBuilder.buildEntity as jest.Mock).mockResolvedValue(createMockDeploymentResult())
      ;(Authenticator.signPayload as jest.Mock).mockReturnValue([])
      ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(createCatalystList('https://catalyst1.zone', 'https://catalyst2.zone'))
    })

    describe('and the deployment is successful on the first catalyst', () => {
      beforeEach(async () => {
        const mockContentClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockContentClient)

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity, [])
      })

      it('should build the deployment entity with correct type and no snapshots', () => {
        expect(DeploymentBuilder.buildEntity).toHaveBeenCalledWith(
          expect.objectContaining({
            type: EntityType.PROFILE,
            pointers: [mockAddress]
          })
        )

        // Verify snapshots were stripped from metadata
        const callArgs = (DeploymentBuilder.buildEntity as jest.Mock).mock.calls[0][0]
        expect(callArgs.metadata.avatars[0].avatar).not.toHaveProperty('snapshots')
      })

      it('should sign the payload with the identity', () => {
        expect(Authenticator.signPayload).toHaveBeenCalledWith(mockIdentity, 'mock-entity-id')
      })

      it('should deploy to the content client', () => {
        const mockContentClient = (createContentClient as jest.Mock).mock.results[0].value
        expect(mockContentClient.deploy).toHaveBeenCalled()
      })
    })

    describe('and the first catalyst fails with a 5xx error', () => {
      let mockContentClient1: { deploy: jest.Mock }
      let mockContentClient2: { deploy: jest.Mock }

      beforeEach(async () => {
        mockContentClient1 = { deploy: jest.fn().mockResolvedValue(createMockResponse(false, 500, 'Internal Server Error')) }
        mockContentClient2 = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
        ;(createContentClient as jest.Mock).mockReturnValueOnce(mockContentClient1).mockReturnValueOnce(mockContentClient2)

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity, [])
      })

      it('should retry with the next catalyst', () => {
        expect(createContentClient).toHaveBeenCalledTimes(2)
      })

      it('should successfully deploy on the second catalyst', () => {
        expect(mockContentClient2.deploy).toHaveBeenCalled()
      })
    })

    describe('and all catalysts fail with a 5xx error', () => {
      beforeEach(() => {
        const mockFailingClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(false, 500, 'Internal Server Error')) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockFailingClient)
      })

      it('should throw a DeploymentError after all retries are exhausted', async () => {
        await expect(redeployExistingProfile(mockProfile, mockAddress, mockIdentity, [])).rejects.toThrow(DeploymentError)
      })
    })

    describe('and a 4xx error occurs', () => {
      beforeEach(() => {
        const mockFailingClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(false, 400, 'Bad Request')) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockFailingClient)
      })

      it('should not retry and throw immediately', async () => {
        await expect(redeployExistingProfile(mockProfile, mockAddress, mockIdentity, [])).rejects.toThrow(DeploymentError)

        // 1 for the deploy attempt (createContentClient is not called for buildEntity anymore)
        expect(createContentClient).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('when redeploying profile with content server data using redeployExistingProfileWithContentServerData', () => {
    const mockCatalystUrl = 'https://catalyst1.zone'
    const mockAddress = DEFAULT_MOCK_ADDRESS
    let mockIdentity: AuthIdentity
    let mockEntity: Entity

    beforeEach(() => {
      ;(DeploymentBuilder.buildEntity as jest.Mock).mockResolvedValue(createMockDeploymentResult())
      ;(Authenticator.signPayload as jest.Mock).mockReturnValue([])
      mockIdentity = createMockIdentity(mockAddress)
      mockEntity = createMockEntity(mockAddress)
      ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(createCatalystList('https://catalyst1.zone', 'https://catalyst2.zone'))
    })

    describe('and the entity is found', () => {
      beforeEach(async () => {
        const mockContentClientForFetch = {
          fetchEntitiesByPointers: jest.fn().mockResolvedValue([mockEntity])
        }

        const mockContentClientForDeploy = {
          deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200))
        }

        ;(createContentClient as jest.Mock).mockReturnValueOnce(mockContentClientForFetch).mockReturnValueOnce(mockContentClientForDeploy)

        await redeployExistingProfileWithContentServerData(mockCatalystUrl, mockAddress, mockIdentity, [])
      })

      it('should fetch the entity by pointer', () => {
        const mockClient = (createContentClient as jest.Mock).mock.results[0].value
        expect(mockClient.fetchEntitiesByPointers).toHaveBeenCalledWith([mockAddress])
      })

      it('should build the deployment entity preserving wearables and without snapshots', () => {
        const callArgs = (DeploymentBuilder.buildEntity as jest.Mock).mock.calls[0][0]
        expect(callArgs.metadata.avatars[0].avatar.wearables).toEqual(['urn:decentraland:off-chain:base-avatars:eyes_00'])
        expect(callArgs.metadata.avatars[0].avatar).not.toHaveProperty('snapshots')
      })
    })

    describe('and the first deployment fails', () => {
      beforeEach(async () => {
        const mockContentClientForFetch = {
          fetchEntitiesByPointers: jest.fn().mockResolvedValue([mockEntity])
        }

        const createFailedDeployClient = () => ({
          deploy: jest.fn().mockResolvedValue(createMockResponse(false, 500, 'Internal Server Error'))
        })

        const createSuccessfulDeployClient = () => ({
          deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200))
        })

        // Rotation list: PEER_URL/content + 2 catalysts from getCatalystServersFromCache = 3 URLs
        ;(createContentClient as jest.Mock)
          .mockReturnValueOnce(mockContentClientForFetch)
          // All catalyst rotation attempts fail for the first buildEntityAndDeploy call
          .mockReturnValueOnce(createFailedDeployClient())
          .mockReturnValueOnce(createFailedDeployClient())
          .mockReturnValueOnce(createFailedDeployClient())
          // Fallback with empty wearables succeeds on first catalyst
          .mockReturnValueOnce(createSuccessfulDeployClient())

        await redeployExistingProfileWithContentServerData(mockCatalystUrl, mockAddress, mockIdentity, [])
      })

      it('should retry with empty wearables', () => {
        const calls = (DeploymentBuilder.buildEntity as jest.Mock).mock.calls
        const lastCall = calls[calls.length - 1][0]
        expect(lastCall.metadata.avatars[0].avatar.wearables).toEqual([])
        expect(lastCall.metadata.avatars[0].avatar).not.toHaveProperty('snapshots')
      })

      it('should have first attempted with wearables preserved', () => {
        const firstCall = (DeploymentBuilder.buildEntity as jest.Mock).mock.calls[0][0]
        expect(firstCall.metadata.avatars[0].avatar.wearables).toEqual(['urn:decentraland:off-chain:base-avatars:eyes_00'])
      })
    })

    describe('and the first deployment fails with a 400 error', () => {
      it('should throw without attempting the empty wearables fallback', async () => {
        const mockContentClientForFetch = {
          fetchEntitiesByPointers: jest.fn().mockResolvedValue([mockEntity])
        }

        const mockContentClientForFailedDeploy = {
          deploy: jest.fn().mockResolvedValue(createMockResponse(false, 400, 'Bad Request'))
        }

        ;(createContentClient as jest.Mock)
          .mockReturnValueOnce(mockContentClientForFetch)
          .mockReturnValueOnce(mockContentClientForFailedDeploy)

        await expect(redeployExistingProfileWithContentServerData(mockCatalystUrl, mockAddress, mockIdentity, [])).rejects.toThrow(
          DeploymentError
        )

        // Only one call to buildEntity — the fallback was never attempted
        expect(DeploymentBuilder.buildEntity).toHaveBeenCalledTimes(1)
      })
    })

    describe('and the entity is not found', () => {
      beforeEach(() => {
        const mockContentClient = {
          fetchEntitiesByPointers: jest.fn().mockResolvedValue([])
        }
        ;(createContentClient as jest.Mock).mockReturnValue(mockContentClient)
      })

      it('should throw a "Profile entity not found" error', async () => {
        await expect(redeployExistingProfileWithContentServerData(mockCatalystUrl, mockAddress, mockIdentity)).rejects.toThrow(
          'Profile entity not found'
        )
      })
    })
  })

  describe('when using catalyst rotation', () => {
    const mockAddress = DEFAULT_MOCK_ADDRESS
    let mockIdentity: AuthIdentity
    let mockProfile: Profile

    beforeEach(() => {
      ;({ profile: mockProfile, identity: mockIdentity } = setupRedeployBase(mockAddress))
      ;(DeploymentBuilder.buildEntity as jest.Mock).mockResolvedValue(createMockDeploymentResult())
      ;(Authenticator.signPayload as jest.Mock).mockReturnValue([])
    })

    describe('and the PEER_URL is prioritized', () => {
      beforeEach(async () => {
        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://peer.decentraland.zone' },
          { address: 'https://catalyst2.zone' }
        ]
        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockContentClient = { deploy: jest.fn().mockResolvedValue(createMockResponse(true, 200)) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockContentClient)

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity, [])
      })

      it('should create the first content client with the PEER_URL', () => {
        expect(createContentClient).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://peer.decentraland.zone/content'
          })
        )
      })
    })

    describe('and there are multiple catalysts available', () => {
      let deployCallUrls: string[]

      beforeEach(async () => {
        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://catalyst2.zone' },
          { address: 'https://catalyst3.zone' },
          { address: 'https://catalyst4.zone' }
        ]
        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        deployCallUrls = []
        ;(createContentClient as jest.Mock).mockImplementation(({ url }) => {
          deployCallUrls.push(url)
          return {
            deploy: jest.fn().mockResolvedValue(createMockResponse(false, 500, 'Internal Server Error'))
          }
        })

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity, []).catch(() => undefined)
      })

      it('should attempt all available catalysts', () => {
        // PEER_URL + 4 catalysts from cache (PEER_URL is excluded from cache list) = 5
        expect(deployCallUrls.length).toBe(5)
      })

      it('should start with the PEER_URL', () => {
        expect(deployCallUrls[0]).toBe('https://peer.decentraland.zone/content')
      })
    })
  })
})

describe('when fetching the profiles of many addresses', () => {
  let getAvatarsDetailsByPost: jest.Mock

  const avatarFor = (address: string, name: string) => ({ avatars: [{ ethAddress: address, name, hasClaimedName: true }] })

  beforeEach(() => {
    getAvatarsDetailsByPost = jest.fn().mockResolvedValue([])
    ;(createLambdasClient as jest.Mock).mockReturnValue({ getAvatarsDetailsByPost })
  })

  describe('and every address has a profile', () => {
    it('should key each one by its own lowercased address', async () => {
      getAvatarsDetailsByPost.mockResolvedValue([avatarFor('0xAAA', 'alice'), avatarFor('0xBBB', 'bob')])

      const profiles = await fetchProfiles(['0xaaa', '0xbbb'])

      expect(profiles.get('0xaaa')?.avatars?.[0].name).toBe('alice')
      expect(profiles.get('0xbbb')?.avatars?.[0].name).toBe('bob')
    })
  })

  describe('and the endpoint answers only for the addresses that have one, in another order', () => {
    it('should attribute by the address each profile reports rather than by position', async () => {
      // The middle address has no profile, so the answer is shorter than the request and out of order.
      // Matching by index here would give bob's name to the account that has none.
      getAvatarsDetailsByPost.mockResolvedValue([avatarFor('0xCCC', 'carol'), avatarFor('0xAAA', 'alice')])

      const profiles = await fetchProfiles(['0xaaa', '0xbbb', '0xccc'])

      expect(profiles.get('0xaaa')?.avatars?.[0].name).toBe('alice')
      expect(profiles.get('0xccc')?.avatars?.[0].name).toBe('carol')
      expect(profiles.has('0xbbb')).toBe(false)
    })
  })

  describe('and a profile reports its address only as a userId', () => {
    it('should still attribute it', async () => {
      getAvatarsDetailsByPost.mockResolvedValue([{ avatars: [{ userId: '0xAAA', name: 'alice', hasClaimedName: true }] }])

      const profiles = await fetchProfiles(['0xaaa'])

      expect(profiles.get('0xaaa')?.avatars?.[0].name).toBe('alice')
    })
  })

  describe('and a profile reports no address at all', () => {
    it('should drop it rather than guess whose it is', async () => {
      getAvatarsDetailsByPost.mockResolvedValue([{ avatars: [{ name: 'nobody', hasClaimedName: true }] }])

      const profiles = await fetchProfiles(['0xaaa'])

      expect(profiles.size).toBe(0)
    })
  })

  describe('and there are more addresses than one request carries', () => {
    let addresses: string[]

    beforeEach(() => {
      addresses = Array.from({ length: 250 }, (_, index) => `0x${index.toString(16).padStart(40, '0')}`)
    })

    it('should chunk them well under the documented bulk ceiling', async () => {
      await fetchProfiles(addresses)

      expect(getAvatarsDetailsByPost).toHaveBeenCalledTimes(3)
      for (const [{ ids }] of getAvatarsDetailsByPost.mock.calls) {
        expect(ids.length).toBeLessThanOrEqual(100)
      }
    })

    it('should ask for every address exactly once across the chunks', async () => {
      await fetchProfiles(addresses)

      const asked = getAvatarsDetailsByPost.mock.calls.flatMap(([{ ids }]) => ids)
      expect(asked).toEqual(addresses)
    })
  })

  describe('and one request fails', () => {
    it('should keep the names the other requests returned', async () => {
      const addresses = Array.from({ length: 150 }, (_, index) => `0x${index.toString(16).padStart(40, '0')}`)
      getAvatarsDetailsByPost
        .mockRejectedValueOnce(new Error('catalyst down'))
        .mockResolvedValueOnce([avatarFor(addresses[120], 'survivor')])

      const profiles = await fetchProfiles(addresses)

      expect(profiles.get(addresses[120])?.avatars?.[0].name).toBe('survivor')
    })
  })
})

// The profile shown next to one address, which is trusted to be that address's and to be safe to put on a
// screen beside an amount. Neither is the endpoint's to promise, so both are checked here.
describe('when fetching the profile of a single address to show beside it', () => {
  const ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5678'
  let getAvatarDetails: jest.Mock

  const profileOf = (overrides: Record<string, unknown>) => ({ avatars: [{ hasClaimedName: true, ...overrides }] })

  beforeEach(() => {
    getAvatarDetails = jest.fn()
    ;(createLambdasClient as jest.Mock).mockReturnValue({ getAvatarDetails })
  })

  describe('and the profile is the one asked for', () => {
    it('should return it, matching the reported address however it is cased', async () => {
      getAvatarDetails.mockResolvedValue(profileOf({ ethAddress: ADDRESS.toUpperCase(), name: 'Alice' }))

      const profile = await fetchProfile(ADDRESS)

      expect(profile?.avatars?.[0].name).toBe('Alice')
    })

    it('should accept a profile that reports its address as userId instead', async () => {
      getAvatarDetails.mockResolvedValue(profileOf({ userId: ADDRESS, name: 'Alice' }))

      const profile = await fetchProfile(ADDRESS)

      expect(profile?.avatars?.[0].name).toBe('Alice')
    })
  })

  describe('and the profile reports a different address', () => {
    it('should refuse it rather than pair the name with the address that was asked about', async () => {
      getAvatarDetails.mockResolvedValue(profileOf({ ethAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb5678', name: 'Alice' }))

      expect(await fetchProfile(ADDRESS)).toBeNull()
    })
  })

  describe('and the profile reports no address at all', () => {
    it('should refuse it, since it is evidence about nobody', async () => {
      getAvatarDetails.mockResolvedValue(profileOf({ name: 'Alice' }))

      expect(await fetchProfile(ADDRESS)).toBeNull()
    })
  })

  describe('and the name carries characters that would lay out the line around it', () => {
    it('should format it once here, so no consumer can render the raw value', async () => {
      getAvatarDetails.mockResolvedValue(profileOf({ ethAddress: ADDRESS, name: '  Alice\u202egnitsopmi  ' }))

      const profile = await fetchProfile(ADDRESS)

      expect(profile?.avatars?.[0].name).toBe('Alice\\u202egnitsopmi')
    })

    it('should cut a name long enough to push the rest of the screen aside', async () => {
      getAvatarDetails.mockResolvedValue(profileOf({ ethAddress: ADDRESS, name: 'A'.repeat(500) }))

      const profile = await fetchProfile(ADDRESS)

      expect((profile?.avatars?.[0].name ?? '').length).toBeLessThanOrEqual(41)
    })
  })

  describe('and the address has no profile', () => {
    it('should return null, as before', async () => {
      getAvatarDetails.mockResolvedValue({ error: 'Profile not found' })

      expect(await fetchProfile(ADDRESS)).toBeNull()
    })
  })
})
