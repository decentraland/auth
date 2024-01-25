import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { DeploymentPreparationData } from 'dcl-catalyst-client/dist/client/types'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { AuthLink, Entity, EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { resizeImage } from './resizeImage'
import { deployProfileFromDefault, subscribeToNewsletter } from './utils'

jest.mock('../../../modules/config')
jest.mock('dcl-catalyst-client')
jest.mock('@dcl/crypto')
jest.mock('./resizeImage')

const mockConfig = config as jest.Mocked<typeof config>
const mockCreateContentClient = createContentClient as jest.MockedFunction<typeof createContentClient>
const mockResizeImage = resizeImage as jest.MockedFunction<typeof resizeImage>
const mockDeploymentBuilder = DeploymentBuilder as jest.Mocked<typeof DeploymentBuilder>
const mockAuthenticator = Authenticator as jest.Mocked<typeof Authenticator>

afterEach(() => {
  jest.clearAllMocks()
})

describe('when subscribing to the newsletter', () => {
  let mockFetch: jest.Mock
  let mockEmail: string
  let mockBuilderServerUrl: string

  beforeEach(() => {
    mockEmail = 'email@domain.com'
    mockBuilderServerUrl = 'https://builder.com'
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  describe('when config does not have a builder server url', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue('')
    })

    it('should fail with a missing builder server url error', async () => {
      await expect(subscribeToNewsletter(mockEmail)).rejects.toThrow('Missing BUILDER_SERVER_URL.')
    })
  })

  describe('when config has a builder server url', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValue(mockBuilderServerUrl)
    })

    describe('when the request response is not ok', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({ ok: false, status: 500 })
      })

      it('should fail with a subscription error containing the status code', async () => {
        await expect(subscribeToNewsletter(mockEmail)).rejects.toThrow('Could not subscribe to newsletter. Status: 500')
      })
    })

    describe('when the request response is ok', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({ ok: true })
      })

      it('should not throw any error', async () => {
        await expect(subscribeToNewsletter(mockEmail)).resolves.not.toThrow()
      })

      it('should have called fetch with the correct url and the correct body', async () => {
        await expect(subscribeToNewsletter(mockEmail)).resolves.not.toThrow()

        expect(mockFetch).toHaveBeenCalledWith(mockBuilderServerUrl + '/v1/newsletter', {
          method: 'post',
          body: JSON.stringify({ email: mockEmail, source: 'auth' }),
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { 'content-type': 'application/json' }
        })
      })
    })
  })
})

describe('when deploying a profile', () => {
  let mockParams: Parameters<typeof deployProfileFromDefault>[0]
  let mockEntity: Entity
  let mockPeerUrl: string
  let mockDownloadedBodyContent: Uint8Array
  let mockDownloadedFaceContent: Uint8Array
  let mockResizedFaceContent: Uint8Array
  let mockBuiltEntity: DeploymentPreparationData
  let mockAuthChain: AuthLink[]
  let mockFetchEntitiesByPointers: jest.Mock
  let mockDownloadContent: jest.Mock
  let mockDeploy: jest.Mock

  beforeEach(() => {
    mockParams = {
      defaultProfile: 'defaultProfile',
      connectedAccount: 'connectedAccount',
      deploymentProfileName: 'deploymentProfileName',
      connectedAccountIdentity: {} as AuthIdentity
    }

    mockEntity = {
      version: 'v3',
      id: 'QmUHmjpHoMizhHdDo2mBuZL6JceTWyAoYXffTgFyNL98x5',
      type: EntityType.PROFILE,
      pointers: ['default52'],
      timestamp: 1581706296003,
      content: [
        {
          file: 'body.png',
          hash: 'QmNSxCVyDpNfUmTeoDP2M2EVgNSiU32c8kAUuevQHraFUv'
        },
        {
          file: 'face.png',
          hash: 'QmXVQ9EdCtpPVme3dNxRiygVcgZts6k1nyBiKfdSxj3Ewv'
        }
      ],
      metadata: {
        avatars: [
          {
            name: '',
            description: '',
            avatar: {
              bodyShape: 'dcl://base-avatars/BaseFemale',
              skin: {
                color: {
                  r: 0.9490196108818054,
                  g: 0.7607843279838562,
                  b: 0.6470588445663452
                }
              },
              hair: {
                color: {
                  r: 0.10980392247438431,
                  g: 0.10980392247438431,
                  b: 0.10980392247438431
                }
              },
              eyes: {
                color: {
                  r: 0.2235294133424759,
                  g: 0.48627451062202454,
                  b: 0.6901960968971252
                }
              },
              wearables: [
                'dcl://base-avatars/colored_sweater',
                'dcl://base-avatars/f_brown_trousers',
                'dcl://base-avatars/crocs',
                'dcl://base-avatars/two_tails',
                'dcl://base-avatars/square_earring',
                'dcl://base-avatars/f_mouth_08'
              ],
              version: 0,
              snapshots: {
                face: 'QmXVQ9EdCtpPVme3dNxRiygVcgZts6k1nyBiKfdSxj3Ewv',
                body: 'QmNSxCVyDpNfUmTeoDP2M2EVgNSiU32c8kAUuevQHraFUv'
              }
            }
          }
        ]
      }
    }

    mockPeerUrl = 'https://peer.com'

    mockDownloadedBodyContent = new Uint8Array([1, 2, 3])
    mockDownloadedFaceContent = new Uint8Array([2, 3, 4])
    mockResizedFaceContent = new Uint8Array([4, 5, 6])
    mockBuiltEntity = { entityId: 'entityId', files: new Map<string, Uint8Array>() }
    mockAuthChain = []

    mockConfig.get.mockReturnValueOnce(mockPeerUrl)

    mockFetchEntitiesByPointers = jest.fn().mockResolvedValue([mockEntity])
    mockDownloadContent = jest.fn()
    mockDeploy = jest.fn()

    mockDownloadContent.mockResolvedValueOnce(mockDownloadedBodyContent)
    mockDownloadContent.mockResolvedValueOnce(mockDownloadedFaceContent)

    mockCreateContentClient.mockReturnValueOnce({
      fetchEntitiesByPointers: mockFetchEntitiesByPointers,
      downloadContent: mockDownloadContent,
      deploy: mockDeploy
    } as unknown as ReturnType<typeof createContentClient>)

    mockResizeImage.mockResolvedValue(mockResizedFaceContent as Buffer)

    mockDeploymentBuilder.buildEntity.mockResolvedValue(mockBuiltEntity)

    mockAuthenticator.signPayload.mockReturnValue(mockAuthChain)
  })

  it('should resolve', async () => {
    await expect(deployProfileFromDefault(mockParams)).resolves.not.toThrow()

    expect(mockCreateContentClient).toHaveBeenCalledWith({ url: mockPeerUrl + '/content', fetcher: expect.anything() })

    expect(mockFetchEntitiesByPointers).toHaveBeenCalledWith([mockParams.defaultProfile])

    expect(mockDownloadContent).toHaveBeenCalledWith(mockEntity.content[0].hash)
    expect(mockDownloadContent).toHaveBeenCalledWith(mockEntity.content[1].hash)

    expect(mockResizeImage).toHaveBeenCalledWith(mockDownloadedFaceContent)

    expect(mockDeploymentBuilder.buildEntity).toHaveBeenCalledWith({
      type: EntityType.PROFILE,
      pointers: [mockParams.connectedAccount],
      timestamp: expect.any(Number),
      files: new Map([
        ['body.png', mockDownloadedBodyContent],
        ['face256.png', mockResizedFaceContent]
      ]),
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
              bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseFemale',
              skin: {
                color: {
                  r: 0.9490196108818054,
                  g: 0.7607843279838562,
                  b: 0.6470588445663452
                }
              },
              hair: {
                color: {
                  r: 0.10980392247438431,
                  g: 0.10980392247438431,
                  b: 0.10980392247438431
                }
              },
              eyes: {
                color: {
                  r: 0.2235294133424759,
                  g: 0.48627451062202454,
                  b: 0.6901960968971252
                }
              },
              wearables: [
                'urn:decentraland:off-chain:base-avatars:colored_sweater',
                'urn:decentraland:off-chain:base-avatars:f_brown_trousers',
                'urn:decentraland:off-chain:base-avatars:crocs',
                'urn:decentraland:off-chain:base-avatars:two_tails',
                'urn:decentraland:off-chain:base-avatars:square_earring',
                'urn:decentraland:off-chain:base-avatars:f_mouth_08'
              ],
              version: 0,
              snapshots: {
                face256: 'bafkreidypr4y4onfxqmrank3vzwqzwd2g2zocd6qeavihy53nmaf3kbuoi',
                body: 'bafkreiadsbmmn4waznesyuz3bjgrj33xzqhxrk6mz3ksq7meugrachh3qe'
              },
              emotes: []
            }
          }
        ]
      }
    })

    expect(mockAuthenticator.signPayload).toHaveBeenCalledWith(mockParams.connectedAccountIdentity, mockBuiltEntity.entityId)

    expect(mockDeploy).toHaveBeenCalledWith({ entityId: mockBuiltEntity.entityId, files: mockBuiltEntity.files, authChain: mockAuthChain })
  })
})
