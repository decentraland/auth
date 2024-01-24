import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { Entity } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { deployProfileFromDefault, subscribeToNewsletter } from './utils'

jest.mock('../../../modules/config')
jest.mock('dcl-catalyst-client')
jest.mock('@dcl/crypto')

const mockConfig = config as jest.Mocked<typeof config>
const mockCreateContentClient = createContentClient as jest.MockedFunction<typeof createContentClient>
const mockDeploymentBuilder = DeploymentBuilder as jest.Mocked<typeof DeploymentBuilder>
const mockAuthenticator = Authenticator as jest.Mocked<typeof Authenticator>

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
      mockConfig.get.mockReturnValueOnce('')
    })

    it('should fail with a missing builder server url error', async () => {
      await expect(subscribeToNewsletter(mockEmail)).rejects.toThrow('Missing BUILDER_SERVER_URL.')
    })
  })

  describe('when config has a builder server url', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValueOnce(mockBuilderServerUrl)
    })

    describe('when the request response is not ok', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
      })

      it('should fail with a subscription error containing the status code', async () => {
        await expect(subscribeToNewsletter(mockEmail)).rejects.toThrow('Could not subscribe to newsletter. Status: 500')
      })
    })

    describe('when the request response is ok', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({ ok: true })
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

describe('when deploying a new profile', () => {
  let mockPeerUrl: string
  let mockDeployProfileFromDefaultParams: Parameters<typeof deployProfileFromDefault>[0]

  beforeEach(() => {
    mockPeerUrl = 'https://peer.com'

    mockDeployProfileFromDefaultParams = {
      connectedAccount: 'connectedAccount',
      connectedAccountIdentity: {} as AuthIdentity,
      defaultProfile: 'defaultProfile',
      deploymentProfileName: 'deploymentProfileName'
    }
  })

  describe('when the config does not have a peer url', () => {
    beforeEach(() => {
      mockConfig.get.mockReturnValueOnce('')
    })

    it('should fail with a missing peer url error', async () => {
      await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Missing PEER_URL.')
    })
  })

  describe('when the config has a peer url', () => {
    let mockEntity: Entity

    beforeEach(() => {
      mockConfig.get.mockReturnValueOnce(mockPeerUrl)

      mockEntity = {
        content: [
          { file: 'body.png', hash: 'bodyHash' },
          { file: 'face256.png', hash: 'faceHash' }
        ],
        metadata: {
          avatars: [
            {
              ethAddress: 'ethAddress',
              name: 'name',
              avatar: {
                bodyShape: 'dcl://base-avatars/bodyShape',
                version: 0,
                wearables: ['dcl://base-avatars/wearable1', 'dcl://base-avatars/wearable2']
              }
            }
          ]
        }
      } as Entity
    })

    describe('when the entities fail to be fetched', () => {
      beforeEach(() => {
        mockCreateContentClient.mockReturnValueOnce({
          fetchEntitiesByPointers: jest.fn().mockRejectedValueOnce(new Error('Fetch Error'))
        } as unknown as ReturnType<typeof createContentClient>)
      })

      it('should fail with a failed to load profile error', async () => {
        await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Fetch Error')
      })
    })

    describe('when the entities fetched are an empty array', () => {
      beforeEach(() => {
        mockCreateContentClient.mockReturnValueOnce({
          fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([])
        } as unknown as ReturnType<typeof createContentClient>)
      })

      it('should fail with a failed to load profile error', async () => {
        await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow(
          `Default profile not found: ${mockDeployProfileFromDefaultParams.defaultProfile}`
        )
      })
    })

    describe('when the entities fetched return an array with an entity', () => {
      describe('when the entity does not have the body file', () => {
        beforeEach(() => {
          mockEntity.content = [{ file: 'face256.png', hash: 'faceHash' }]

          mockCreateContentClient.mockReturnValueOnce({
            fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity])
          } as unknown as ReturnType<typeof createContentClient>)
        })

        it('should fail with a failed to load profile error', async () => {
          await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow(
            `Missing files in default entity content: ${mockDeployProfileFromDefaultParams.defaultProfile}`
          )
        })
      })

      describe('when the entity does not have the face file', () => {
        beforeEach(() => {
          mockEntity.content = [{ file: 'body.png', hash: 'bodyHash' }]

          mockCreateContentClient.mockReturnValueOnce({
            fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity])
          } as unknown as ReturnType<typeof createContentClient>)
        })

        it('should fail with a failed to load profile error', async () => {
          await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow(
            `Missing files in default entity content: ${mockDeployProfileFromDefaultParams.defaultProfile}`
          )
        })
      })

      describe('when the entity has both files', () => {
        let mockDownloadContent: jest.Mock

        beforeEach(() => {
          mockDownloadContent = jest.fn()
        })

        describe('when the body cannot be downloaded', () => {
          beforeEach(() => {
            mockDownloadContent.mockRejectedValueOnce(new Error('Body Download Error'))

            mockCreateContentClient.mockReturnValueOnce({
              fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
              downloadContent: mockDownloadContent
            } as unknown as ReturnType<typeof createContentClient>)
          })

          it('should fail with a failed to download body error', async () => {
            await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Body Download Error')
          })
        })

        describe('when the face cannot be downloaded', () => {
          beforeEach(() => {
            mockDownloadContent.mockResolvedValueOnce(new Uint8Array())
            mockDownloadContent.mockRejectedValueOnce(new Error('Face Download Error'))

            mockCreateContentClient.mockReturnValueOnce({
              fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
              downloadContent: mockDownloadContent
            } as unknown as ReturnType<typeof createContentClient>)
          })

          it('should fail with a failed to download face error', async () => {
            await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Face Download Error')
          })
        })

        describe('when both files can be downloaded', () => {
          beforeEach(() => {
            mockDownloadContent.mockResolvedValueOnce(new Uint8Array())
            mockDownloadContent.mockResolvedValueOnce(new Uint8Array())
          })

          describe('when the entity does not have an avatar', () => {
            beforeEach(() => {
              delete mockEntity.metadata

              mockCreateContentClient.mockReturnValueOnce({
                fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
                downloadContent: mockDownloadContent
              } as unknown as ReturnType<typeof createContentClient>)
            })

            it('should fail with a missing avatar error', async () => {
              await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow(
                `Missing avatar in default entity metadata: ${mockDeployProfileFromDefaultParams.defaultProfile}`
              )
            })
          })

          describe('when the entity has an avatar', () => {
            describe('when the entity cannot be built', () => {
              beforeEach(() => {
                mockCreateContentClient.mockReturnValueOnce({
                  fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
                  downloadContent: mockDownloadContent
                } as unknown as ReturnType<typeof createContentClient>)

                mockDeploymentBuilder.buildEntity.mockRejectedValueOnce(new Error('Failed to build entity'))
              })

              it('should fail with a failed to build error', async () => {
                await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Failed to build entity')
              })
            })

            describe('when the entity can be built', () => {
              beforeEach(() => {
                mockDeploymentBuilder.buildEntity.mockResolvedValueOnce({ entityId: 'entityId', files: new Map() })
              })

              describe('when signing the payload fails', () => {
                beforeEach(() => {
                  mockCreateContentClient.mockReturnValueOnce({
                    fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
                    downloadContent: mockDownloadContent
                  } as unknown as ReturnType<typeof createContentClient>)

                  mockAuthenticator.signPayload.mockImplementationOnce(() => {
                    throw new Error('Failed to sign payload')
                  })
                })

                it('should fail with a failed to deploy error', async () => {
                  await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Failed to sign payload')
                })
              })

              describe('when signing the payload does not fail', () => {
                beforeEach(() => {
                  mockAuthenticator.signPayload.mockReturnValueOnce([])
                })

                describe('when the deployment fails', () => {
                  beforeEach(() => {
                    mockCreateContentClient.mockReturnValueOnce({
                      fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
                      downloadContent: mockDownloadContent,
                      deploy: jest.fn().mockRejectedValueOnce(new Error('Failed to deploy'))
                    } as unknown as ReturnType<typeof createContentClient>)
                  })

                  it('should fail with a failed to deploy error', async () => {
                    await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).rejects.toThrow('Failed to deploy')
                  })
                })

                describe('when the deployment does not fail', () => {
                  beforeEach(() => {
                    mockCreateContentClient.mockReturnValueOnce({
                      fetchEntitiesByPointers: jest.fn().mockResolvedValueOnce([mockEntity]),
                      downloadContent: mockDownloadContent,
                      deploy: jest.fn()
                    } as unknown as ReturnType<typeof createContentClient>)
                  })

                  it('should resolve', async () => {
                    await expect(deployProfileFromDefault(mockDeployProfileFromDefaultParams)).resolves.not.toThrow()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
