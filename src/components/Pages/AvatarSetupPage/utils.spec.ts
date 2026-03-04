import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { Authenticator } from '@dcl/crypto'
import { EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { deployProfileFromAvatarShape } from './utils'
import { AvatarShape, Color, DeploymentParams } from './AvatarSetupPage.types'

jest.mock('../../../modules/config')
jest.mock('dcl-catalyst-client')
jest.mock('@dcl/crypto')

const mockConfig = config as jest.Mocked<typeof config>
const mockCreateContentClient = createContentClient as jest.MockedFunction<typeof createContentClient>
const mockDeploymentBuilder = DeploymentBuilder as jest.Mocked<typeof DeploymentBuilder>
const mockAuthenticator = Authenticator as jest.Mocked<typeof Authenticator>

describe('deployProfileFromAvatarShape', () => {
  let mockParams: DeploymentParams
  let mockPeerUrl: string
  let mockBuiltEntity: { entityId: string; files: Map<string, Uint8Array> }
  let mockAuthChain: Array<{ type: string; payload: string; signature: string }>
  let mockContentClient: {
    deploy: jest.Mock
  }
  let mockAvatarShape: AvatarShape
  let mockEyeColor: Color
  let mockSkinColor: Color
  let mockHairColor: Color

  beforeEach(() => {
    jest.clearAllMocks()

    mockEyeColor = { r: 0.6650376319885254, g: 0.2478034943342209, b: 0.22760024666786194, a: 1 }
    mockSkinColor = { r: 0.9490196108818054, g: 0.7607843279838562, b: 0.6470588445663452, a: 1 }
    mockHairColor = { r: 0.5686274766921997, g: 0.2549019455909729, b: 0.14117644727230072, a: 1 }

    mockAvatarShape = {
      bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
      eyeColor: mockEyeColor,
      skinColor: mockSkinColor,
      hairColor: mockHairColor,
      wearables: [
        'urn:decentraland:off-chain:base-avatars:eyes_02',
        'urn:decentraland:off-chain:base-avatars:f_mouth_02',
        'urn:decentraland:matic:collections-v2:0xc43914be599f3f8fe4956aa3ec9d6a6aead1edfa:1',
        'urn:decentraland:matic:collections-v2:0x80f54870df28850f9ce681ddcbf4bd7b18b007fb:1',
        'urn:decentraland:off-chain:base-avatars:hair_coolshortstyle',
        'urn:decentraland:matic:collections-v2:0xc43914be599f3f8fe4956aa3ec9d6a6aead1edfa:3',
        'urn:decentraland:matic:collections-v2:0xc43914be599f3f8fe4956aa3ec9d6a6aead1edfa:2'
      ]
    }

    mockParams = {
      avatarShape: mockAvatarShape,
      connectedAccount: '0x69d30b1875d39e13a01af73ccfed6d84839e84f2',
      deploymentProfileName: 'TestUser',
      connectedAccountIdentity: { privateKey: 'mock-private-key' } as unknown as DeploymentParams['connectedAccountIdentity']
    }

    mockPeerUrl = 'https://peer.decentraland.org'
    mockBuiltEntity = {
      entityId: 'mock-entity-id',
      files: new Map()
    }
    mockAuthChain = [{ type: 'SIGNER', payload: 'mock-payload', signature: 'mock-signature' }]

    mockContentClient = {
      deploy: jest.fn().mockResolvedValue(undefined)
    }

    mockConfig.get.mockReturnValue(mockPeerUrl)
    mockCreateContentClient.mockReturnValue(mockContentClient as unknown as ReturnType<typeof createContentClient>)
    mockDeploymentBuilder.buildEntity.mockResolvedValue(
      mockBuiltEntity as unknown as Awaited<ReturnType<typeof DeploymentBuilder.buildEntity>>
    )
    mockAuthenticator.signPayload.mockReturnValue(mockAuthChain as unknown as ReturnType<typeof Authenticator.signPayload>)
  })

  describe('when all parameters are valid', () => {
    it('should create content client with correct URL', async () => {
      await expect(deployProfileFromAvatarShape(mockParams)).resolves.not.toThrow()

      expect(mockConfig.get).toHaveBeenCalledWith('PEER_URL', '')
      expect(mockCreateContentClient).toHaveBeenCalledWith({
        url: mockPeerUrl + '/content',
        fetcher: expect.anything()
      })
    })

    it('should build entity with correct avatar metadata without snapshots', async () => {
      await deployProfileFromAvatarShape(mockParams)

      expect(mockDeploymentBuilder.buildEntity).toHaveBeenCalledWith({
        type: EntityType.PROFILE,
        pointers: [mockParams.connectedAccount],
        timestamp: expect.any(Number),
        files: new Map(),
        metadata: {
          avatars: [
            {
              name: mockParams.deploymentProfileName,
              description: '',
              ethAddress: mockParams.connectedAccount,
              userId: mockParams.connectedAccount,
              version: 1,
              tutorialStep: 0,
              hasClaimedName: false,
              hasConnectedWeb3: true,
              avatar: {
                bodyShape: mockAvatarShape.bodyShape,
                wearables: mockAvatarShape.wearables,
                emotes: [],
                eyes: { color: mockEyeColor },
                skin: { color: mockSkinColor },
                hair: { color: mockHairColor }
              }
            }
          ]
        }
      })
    })

    it('should sign payload with correct parameters', async () => {
      await deployProfileFromAvatarShape(mockParams)

      expect(mockAuthenticator.signPayload).toHaveBeenCalledWith(mockParams.connectedAccountIdentity, mockBuiltEntity.entityId)
    })

    it('should deploy with expected id, files and authChain', async () => {
      await deployProfileFromAvatarShape(mockParams)

      expect(mockContentClient.deploy).toHaveBeenCalledWith({
        entityId: mockBuiltEntity.entityId,
        files: mockBuiltEntity.files,
        authChain: mockAuthChain
      })
    })
  })

  describe('when buildEntity fails', () => {
    beforeEach(() => {
      mockDeploymentBuilder.buildEntity.mockRejectedValue(new Error('Failed to build entity'))
    })

    it('should throw an error and log the failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(deployProfileFromAvatarShape(mockParams)).rejects.toThrow('Failed to build entity')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to deploy profile from avatar shape:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('when deploy fails', () => {
    beforeEach(() => {
      mockContentClient.deploy.mockRejectedValue(new Error('Failed to deploy'))
    })

    it('should throw an error and log the failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(deployProfileFromAvatarShape(mockParams)).rejects.toThrow('Failed to deploy')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to deploy profile from avatar shape:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })
})
