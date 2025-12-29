import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { Authenticator } from '@dcl/crypto'
import { EntityType, Entity } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { deployProfileFromAvatarShape } from './utils'
import { DeploymentParams, AvatarShape, Color } from './AvatarSetupPage.types'

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
  let mockDefaultEntity: Entity
  let mockBodyBuffer: Uint8Array
  let mockFaceBuffer: Uint8Array
  let mockBuiltEntity: { entityId: string; files: Map<string, Uint8Array> }
  let mockAuthChain: Array<{ type: string; payload: string; signature: string }>
  let mockContentClient: {
    fetchEntitiesByPointers: jest.Mock
    downloadContent: jest.Mock
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
      connectedAccountIdentity: { privateKey: 'mock-private-key' } as any
    }

    mockPeerUrl = 'https://peer.decentraland.org'
    mockBodyBuffer = new Uint8Array([1, 2, 3, 4])
    mockFaceBuffer = new Uint8Array([5, 6, 7, 8])
    mockBuiltEntity = {
      entityId: 'mock-entity-id',
      files: new Map([
        ['body.png', mockBodyBuffer],
        ['face256.png', mockFaceBuffer]
      ])
    }
    mockAuthChain = [{ type: 'SIGNER', payload: 'mock-payload', signature: 'mock-signature' }]

    mockDefaultEntity = {
      version: 'v3',
      id: 'bafkreidm7vujpipkjcrntulaqso72c74polpl6v73w4baf7dpyq6ula3lu',
      type: EntityType.PROFILE,
      pointers: ['default1'],
      timestamp: 1689277989804,
      content: [
        {
          file: 'body.png',
          hash: 'bafkreibcd4qcbtizhykjnnimypg7pzbgeeyovdcf7hbgejzwhlatgknuji'
        },
        {
          file: 'face256.png',
          hash: 'bafkreicewdls4xaaudfazngdag2a3snopl4sqs32bzany7uj6hcupb6lxy'
        }
      ],
      metadata: {
        avatars: [
          {
            name: 'default',
            description: '',
            avatar: {
              bodyShape: 'dcl://base-avatars/BaseFemale',
              skin: { color: mockSkinColor },
              hair: { color: mockHairColor },
              eyes: { color: mockEyeColor },
              wearables: ['dcl://base-avatars/colored_sweater'],
              version: 0,
              snapshots: {
                body: 'bafkreibcd4qcbtizhykjnnimypg7pzbgeeyovdcf7hbgejzwhlatgknuji',
                face256: 'bafkreicewdls4xaaudfazngdag2a3snopl4sqs32bzany7uj6hcupb6lxy'
              },
              emotes: []
            },
            ethAddress: '0x0000000000000000000000000000000000000000',
            version: 0,
            tutorialStep: 0,
            hasClaimedName: false
          }
        ]
      }
    }

    mockContentClient = {
      fetchEntitiesByPointers: jest.fn().mockResolvedValue([mockDefaultEntity]),
      downloadContent: jest.fn(),
      deploy: jest.fn().mockResolvedValue(undefined)
    }

    mockContentClient.downloadContent.mockResolvedValueOnce(mockBodyBuffer).mockResolvedValueOnce(mockFaceBuffer)

    mockConfig.get.mockReturnValue(mockPeerUrl)
    mockCreateContentClient.mockReturnValue(mockContentClient as any)
    mockDeploymentBuilder.buildEntity.mockResolvedValue(mockBuiltEntity as any)
    mockAuthenticator.signPayload.mockReturnValue(mockAuthChain as any)
  })

  describe('when all parameters are valid', () => {
    it('should download profile and content from catalyst', async () => {
      await expect(deployProfileFromAvatarShape(mockParams)).resolves.not.toThrow()

      expect(mockConfig.get).toHaveBeenCalledWith('PEER_URL', '')
      expect(mockCreateContentClient).toHaveBeenCalledWith({
        url: mockPeerUrl + '/content',
        fetcher: expect.anything()
      })
      expect(mockContentClient.fetchEntitiesByPointers).toHaveBeenCalledWith(['default1'])
      expect(mockContentClient.downloadContent).toHaveBeenCalledWith('bafkreibcd4qcbtizhykjnnimypg7pzbgeeyovdcf7hbgejzwhlatgknuji')
      expect(mockContentClient.downloadContent).toHaveBeenCalledWith('bafkreicewdls4xaaudfazngdag2a3snopl4sqs32bzany7uj6hcupb6lxy')
    })

    it('should build entity with correct avatar metadata', async () => {
      await deployProfileFromAvatarShape(mockParams)

      expect(mockDeploymentBuilder.buildEntity).toHaveBeenCalledWith({
        type: EntityType.PROFILE,
        pointers: [mockParams.connectedAccount],
        timestamp: expect.any(Number),
        files: expect.any(Map),
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
                hair: { color: mockHairColor },
                snapshots: {
                  body: 'bafkreibcd4qcbtizhykjnnimypg7pzbgeeyovdcf7hbgejzwhlatgknuji',
                  face256: 'bafkreicewdls4xaaudfazngdag2a3snopl4sqs32bzany7uj6hcupb6lxy'
                }
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

  describe('when fetchEntitiesByPointers fails', () => {
    beforeEach(() => {
      mockContentClient.fetchEntitiesByPointers.mockRejectedValue(new Error('Failed to fetch entities'))
    })

    it('should throw an error and log the failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(deployProfileFromAvatarShape(mockParams)).rejects.toThrow('Failed to fetch entities')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to deploy profile from avatar shape:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('when downloadContent fails', () => {
    beforeEach(() => {
      mockContentClient.downloadContent.mockReset()
      mockContentClient.downloadContent.mockRejectedValue(new Error('Failed to download content'))
    })

    it('should throw an error and log the failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(deployProfileFromAvatarShape(mockParams)).rejects.toThrow('Failed to download content')

      expect(consoleSpy).toHaveBeenCalledWith('Failed to deploy profile from avatar shape:', expect.any(Error))

      consoleSpy.mockRestore()
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
