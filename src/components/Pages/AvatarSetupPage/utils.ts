import { DeploymentBuilder, createContentClient } from 'dcl-catalyst-client'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { L1Network } from '@dcl/catalyst-contracts'
import { Authenticator } from '@dcl/crypto'
import { Avatar, EntityType } from '@dcl/schemas'
import { config } from '../../../modules/config'
import { fetcher } from '../../../shared/fetcher'
import { CreateAvatarMetadataParams, DeploymentParams } from './AvatarSetupPage.types'

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
 * Returns content API URLs for all available catalysts, with the configured PEER_URL first.
 * Used for deployment rotation — if the primary catalyst fails, subsequent URLs are tried in order.
 * @returns Content URLs in the form `{catalystAddress}/content`
 */
function getCatalystContentUrls(): string[] {
  const peerUrl = config.get('PEER_URL', '')
  const environment = config.get('ENVIRONMENT')
  const network: L1Network = environment === 'development' ? 'sepolia' : 'mainnet'
  const catalystServers = getCatalystServersFromCache(network).filter(server => server.address !== peerUrl)

  return [peerUrl + '/content', ...catalystServers.map(server => server.address + '/content')]
}

/**
 * Deploys a user profile to the Decentraland catalyst based on avatar shape configuration.
 * Rotates through available catalysts on network failures.
 * @param params - Deployment parameters including avatar shape and account info
 * @throws Error if deployment fails on all catalysts
 */
const deployProfileFromAvatarShape = async ({
  avatarShape,
  connectedAccount,
  deploymentProfileName,
  connectedAccountIdentity
}: DeploymentParams) => {
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

  const catalystUrls = getCatalystContentUrls()

  for (let attempt = 0; attempt < catalystUrls.length; attempt++) {
    const catalystUrl = catalystUrls[attempt]

    try {
      const client = createContentClient({ url: catalystUrl, fetcher })
      await client.deploy({
        entityId: deploymentEntity.entityId,
        files: deploymentEntity.files,
        authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
      })
      return
    } catch (error) {
      console.error(`Failed to deploy profile from avatar shape on ${catalystUrl} (attempt ${attempt + 1}/${catalystUrls.length}):`, error)

      const isLastAttempt = attempt === catalystUrls.length - 1
      if (isLastAttempt) {
        throw error
      }
    }
  }
}

export { deployProfileFromAvatarShape }
