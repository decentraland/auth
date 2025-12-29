import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { Authenticator } from '@dcl/crypto'
import { Avatar, EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { fetcher } from '../../../shared/fetcher'
import { ContentClient, DeploymentParams, ContentHashes, CreateAvatarMetadataParams } from './AvatarSetupPage.types'

/**
 * Creates a content client for interacting with the Decentraland catalyst
 * @returns Configured content client instance
 */
const createCatalystClient = (): ContentClient => {
  const peerUrl = config.get('PEER_URL', '')
  return createContentClient({ url: peerUrl + '/content', fetcher })
}

/**
 * Creates a mapping of file names to their content hashes
 * @param content - Array of file-hash pairs from entity content
 * @returns Object mapping file names to hashes
 */
const createContentHashesMap = (content: Array<{ file: string; hash: string }>): ContentHashes => {
  return content.reduce((acc, next) => ({ ...acc, [next.file]: next.hash }), {} as ContentHashes)
}

/**
 * Downloads required avatar assets (body and face images)
 * @param client - Content client instance
 * @param contentHashes - Mapping of file names to hashes
 * @returns Object containing downloaded files and file names
 */
const downloadAvatarAssets = async (client: ContentClient, contentHashes: ContentHashes) => {
  const bodyFileName = 'body.png'
  const face256FileName = 'face256.png'

  const [bodyBuffer, faceBuffer] = await Promise.all([
    client.downloadContent(contentHashes[bodyFileName]),
    client.downloadContent(contentHashes[face256FileName])
  ])

  const files = new Map<string, Uint8Array>()
  files.set(bodyFileName, bodyBuffer)
  files.set(face256FileName, faceBuffer)

  return { files, bodyFileName, face256FileName }
}

/**
 * Creates avatar metadata from the provided parameters
 * @param params - Object containing all parameters needed to create avatar metadata
 * @returns Complete avatar metadata object
 */
const createAvatarMetadata = ({
  avatarShape,
  connectedAccount,
  deploymentProfileName,
  contentHashes,
  bodyFileName,
  face256FileName
}: CreateAvatarMetadataParams): Avatar => {
  return {
    name: deploymentProfileName,
    description: '',
    ethAddress: connectedAccount,
    userId: connectedAccount,
    version: 1,
    tutorialStep: 0,
    hasClaimedName: false,
    hasConnectedWeb3: true,
    avatar: {
      bodyShape: avatarShape.bodyShape,
      wearables: avatarShape.wearables,
      emotes: [],
      eyes: { color: avatarShape.eyeColor },
      skin: { color: avatarShape.skinColor },
      hair: { color: avatarShape.hairColor },
      snapshots: {
        body: contentHashes[bodyFileName],
        face256: contentHashes[face256FileName]
      }
    }
  }
}

/**
 * Deploys a user profile to the Decentraland catalyst based on avatar shape configuration
 * @param params - Deployment parameters including avatar shape and account info
 * @throws Error if deployment fails
 */
const deployProfileFromAvatarShape = async ({
  avatarShape,
  connectedAccount,
  deploymentProfileName,
  connectedAccountIdentity
}: DeploymentParams) => {
  try {
    const client = createCatalystClient()
    // This is used to fake the body and face256 hashes, it's required in Catalyst but not used anymore
    const defaultEntity = (await client.fetchEntitiesByPointers(['default1']))[0]
    const contentHashes = createContentHashesMap(defaultEntity.content)
    const { files, bodyFileName, face256FileName } = await downloadAvatarAssets(client, contentHashes)

    const avatar = createAvatarMetadata({
      avatarShape,
      connectedAccount,
      deploymentProfileName,
      contentHashes,
      bodyFileName,
      face256FileName
    })

    const deploymentEntity = await DeploymentBuilder.buildEntity({
      type: EntityType.PROFILE,
      pointers: [connectedAccount],
      metadata: { avatars: [avatar] },
      timestamp: Date.now(),
      files
    })

    await client.deploy({
      entityId: deploymentEntity.entityId,
      files: deploymentEntity.files,
      authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
    })
  } catch (error) {
    console.error('Failed to deploy profile from avatar shape:', error)
    throw error
  }
}

export { deployProfileFromAvatarShape }
