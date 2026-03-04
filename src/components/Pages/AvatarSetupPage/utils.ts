import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { Authenticator } from '@dcl/crypto'
import { Avatar, EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { fetcher } from '../../../shared/fetcher'
import { DeploymentParams, CreateAvatarMetadataParams } from './AvatarSetupPage.types'

/**
 * Creates avatar metadata from the provided parameters
 * @param params - Object containing all parameters needed to create avatar metadata
 * @returns Complete avatar metadata object
 */
const createAvatarMetadata = ({ avatarShape, connectedAccount, deploymentProfileName }: CreateAvatarMetadataParams): Avatar => {
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
      hair: { color: avatarShape.hairColor }
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
    const peerUrl = config.get('PEER_URL', '')
    const client = createContentClient({ url: peerUrl + '/content', fetcher })

    const avatar = createAvatarMetadata({
      avatarShape,
      connectedAccount,
      deploymentProfileName
    })

    const deploymentEntity = await DeploymentBuilder.buildEntity({
      type: EntityType.PROFILE,
      pointers: [connectedAccount],
      metadata: { avatars: [avatar] },
      timestamp: Date.now(),
      files: new Map()
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
