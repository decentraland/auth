import { createContentClient, createLambdasClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { hashV1 } from '@dcl/hashing'
import { Entity, EntityType } from '@dcl/schemas'
import {
  createMockIdentity,
  createMockProfile,
  createMockEntity,
  DEFAULT_MOCK_ADDRESS,
  createMockDeploymentResult
} from '../../tests/mocks/profile'
import { config } from '../config'
import {
  fetchProfileWithConsistencyCheck,
  redeployExistingProfile,
  redeployExistingProfileWithContentServerData,
  buildProfileMetadata
} from './index'

// Mock dependencies
jest.mock('@well-known-components/fetch-component', () => ({
  createFetchComponent: jest.fn(() => ({}))
}))

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

jest.mock('@dcl/hashing', () => ({
  hashV1: jest.fn()
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

const setupRedeployBase = (address: string = DEFAULT_MOCK_ADDRESS) => {
  const profile = createMockProfile(address)
  const identity = createMockIdentity(address)

  global.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
  })
  ;(hashV1 as jest.Mock).mockResolvedValue('mock-hash')

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

        result = await fetchProfileWithConsistencyCheck(mockAddress)
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

        result = await fetchProfileWithConsistencyCheck(mockAddress)
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return the newest profile', () => {
        expect(result.profile).toEqual(newestProfile)
      })
    })

    describe('and some catalysts do not have the profile', () => {
      beforeEach(async () => {
        mockProfile = { timestamp: 1000, avatars: [] }

        const mockCatalysts = [
          { address: 'https://catalyst1.zone' },
          { address: 'https://catalyst2.zone' },
          { address: 'https://catalyst3.zone' }
        ]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockClientWithProfile = { getAvatarDetails: jest.fn().mockResolvedValue(mockProfile) }
        const mockClientWithoutProfile = { getAvatarDetails: jest.fn().mockRejectedValue(new Error('404')) }

        ;(createLambdasClient as jest.Mock)
          .mockReturnValueOnce(mockClientWithProfile)
          .mockReturnValueOnce(mockClientWithoutProfile)
          .mockReturnValueOnce(mockClientWithProfile)

        result = await fetchProfileWithConsistencyCheck(mockAddress)
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should still return the available profile', () => {
        expect(result.profile).toEqual(mockProfile)
      })
    })

    describe('and no catalysts have the profile', () => {
      beforeEach(async () => {
        const mockCatalysts = [{ address: 'https://catalyst1.zone' }, { address: 'https://catalyst2.zone' }]

        ;(getCatalystServersFromCache as jest.Mock).mockReturnValue(mockCatalysts)

        const mockClientWithoutProfile = { getAvatarDetails: jest.fn().mockRejectedValue(new Error('404')) }
        ;(createLambdasClient as jest.Mock).mockReturnValue(mockClientWithoutProfile)

        result = await fetchProfileWithConsistencyCheck(mockAddress)
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
    })

    describe('and an unexpected error occurs', () => {
      let errorMessage: string

      beforeEach(async () => {
        errorMessage = 'Unexpected failure'
        ;(getCatalystServersFromCache as jest.Mock).mockImplementation(() => {
          throw new Error(errorMessage)
        })

        result = await fetchProfileWithConsistencyCheck(mockAddress)
      })

      it('should return isConsistent as false', () => {
        expect(result.isConsistent).toBe(false)
      })

      it('should return the error message', () => {
        expect(result.error).toContain(errorMessage)
      })
    })
  })

  describe('when building profile metadata with buildProfileMetadata', () => {
    describe('and valid profile and files are provided', () => {
      let result: Partial<Profile>
      let mockProfile: Profile
      let files: Map<string, Uint8Array>

      beforeEach(async () => {
        mockProfile = createMockProfile()

        files = new Map<string, Uint8Array>()
        files.set('body.png', new Uint8Array([1, 2, 3]))
        files.set('face256.png', new Uint8Array([4, 5, 6]))
        ;(hashV1 as jest.Mock).mockResolvedValueOnce('hash-body').mockResolvedValueOnce('hash-face256')

        result = await buildProfileMetadata(mockProfile, files)
      })

      it('should hash the body file', () => {
        expect(hashV1).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
      })

      it('should hash the face file', () => {
        expect(hashV1).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]))
      })

      it('should return metadata with updated snapshots', () => {
        expect(result.avatars?.[0]?.avatar?.snapshots).toEqual({
          body: 'hash-body',
          face256: 'hash-face256'
        })
      })

      it('should preserve other avatar properties', () => {
        expect(result.avatars?.[0]?.name).toBe('TestAvatar')
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
        const mockContentClient = { deploy: jest.fn().mockResolvedValue({}) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockContentClient)

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity)
      })

      it('should fetch body and face snapshots', () => {
        expect(global.fetch).toHaveBeenCalledWith('https://peer.decentraland.zone/content/body')
        expect(global.fetch).toHaveBeenCalledWith('https://peer.decentraland.zone/content/face256')
      })

      it('should build the deployment entity with correct type', () => {
        expect(DeploymentBuilder.buildEntity).toHaveBeenCalledWith(
          expect.objectContaining({
            type: EntityType.PROFILE,
            pointers: [mockAddress]
          })
        )
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
        mockContentClient1 = { deploy: jest.fn().mockRejectedValue({ status: 500 }) }
        mockContentClient2 = { deploy: jest.fn().mockResolvedValue({}) }
        ;(createContentClient as jest.Mock).mockReturnValueOnce(mockContentClient1).mockReturnValueOnce(mockContentClient2)

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity)
      })

      it('should retry with the next catalyst', () => {
        expect(createContentClient).toHaveBeenCalledTimes(2)
      })

      it('should successfully deploy on the second catalyst', () => {
        expect(mockContentClient2.deploy).toHaveBeenCalled()
      })
    })

    describe('and all catalysts fail', () => {
      beforeEach(() => {
        const mockFailingClient = { deploy: jest.fn().mockRejectedValue({ status: 500 }) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockFailingClient)
      })

      it('should throw an error after all retries are exhausted', async () => {
        await expect(redeployExistingProfile(mockProfile, mockAddress, mockIdentity)).rejects.toEqual({ status: 500 })
      })
    })

    describe('and a 4xx error occurs', () => {
      beforeEach(() => {
        const mockFailingClient = { deploy: jest.fn().mockRejectedValue({ status: 400 }) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockFailingClient)
      })

      it('should not retry and throw immediately', async () => {
        await expect(redeployExistingProfile(mockProfile, mockAddress, mockIdentity)).rejects.toEqual({
          status: 400
        })

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
          fetchEntitiesByPointers: jest.fn().mockResolvedValue([mockEntity]),
          downloadContent: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
        }

        const mockContentClientForDeploy = {
          deploy: jest.fn().mockResolvedValue({})
        }

        ;(createContentClient as jest.Mock).mockReturnValueOnce(mockContentClientForFetch).mockReturnValueOnce(mockContentClientForDeploy)

        await redeployExistingProfileWithContentServerData(mockCatalystUrl, mockAddress, mockIdentity)
      })

      it('should fetch the entity by pointer', () => {
        const mockClient = (createContentClient as jest.Mock).mock.results[0].value
        expect(mockClient.fetchEntitiesByPointers).toHaveBeenCalledWith([mockAddress])
      })

      it('should download body content', () => {
        const mockClient = (createContentClient as jest.Mock).mock.results[0].value
        expect(mockClient.downloadContent).toHaveBeenCalledWith('body-hash')
      })

      it('should download face content', () => {
        const mockClient = (createContentClient as jest.Mock).mock.results[0].value
        expect(mockClient.downloadContent).toHaveBeenCalledWith('face-hash')
      })

      it('should build the deployment entity with empty wearables', () => {
        expect(DeploymentBuilder.buildEntity).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              avatars: expect.arrayContaining([
                expect.objectContaining({
                  avatar: expect.objectContaining({
                    wearables: []
                  })
                })
              ])
            })
          })
        )
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

        const mockContentClient = { deploy: jest.fn().mockResolvedValue({}) }
        ;(createContentClient as jest.Mock).mockReturnValue(mockContentClient)

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity)
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
            deploy: jest.fn().mockRejectedValue({ status: 500 })
          }
        })

        await redeployExistingProfile(mockProfile, mockAddress, mockIdentity).catch(() => undefined)
      })

      it('should attempt up to 3 catalysts maximum', () => {
        expect(deployCallUrls.length).toBe(3)
      })

      it('should start with the PEER_URL', () => {
        expect(deployCallUrls[0]).toBe('https://peer.decentraland.zone/content')
      })
    })
  })
})
