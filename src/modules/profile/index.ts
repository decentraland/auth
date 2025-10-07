import { createFetchComponent } from '@well-known-components/fetch-component'
import { createLambdasClient, createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { Entity, EntityType } from '@dcl/schemas'
import { config } from '../config'

export interface ConsistencyResult {
  isConsistent: boolean
  entity?: Entity
  error?: string
}

export async function fetchProfile(address: string): Promise<Profile | null> {
  const PEER_URL = config.get('PEER_URL')
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher: createFetchComponent() })
  try {
    const profile: Profile = await client.getAvatarDetails(address)
    return profile
  } catch (error) {
    return null
  }
}

export async function fetchProfileWithConsistencyCheck(address: string): Promise<ConsistencyResult> {
  try {
    // Determine network based on environment
    const environment = config.get('ENVIRONMENT')
    const network = environment === 'development' ? 'sepolia' : 'mainnet'

    // Create content client for consistency check
    const PEER_URL = config.get('PEER_URL')
    const client = createContentClient({
      url: PEER_URL + '/content',
      fetcher: createFetchComponent()
    })

    // Get all catalyst servers for the network and remove the current peer to avoid duplicated fetches
    const catalystServers = getCatalystServersFromCache(network)
    const catalystUrls = catalystServers
      .map(server => `${server.address}/content`)
      .filter(url => url.toLowerCase() !== `${PEER_URL}/content`.toLowerCase())

    // Check pointer consistency across all catalysts
    const consistencyResult = await client.checkPointerConsistency(address, {
      parallel: {
        urls: catalystUrls
      }
    })

    if (!consistencyResult.isConsistent) {
      // Check if we have any valid entity from inconsistent catalysts
      // This entity can be used for redeployment to fix the inconsistency
      const validEntity =
        consistencyResult.upToDateEntities && consistencyResult.upToDateEntities.length > 0
          ? consistencyResult.upToDateEntities[0]
          : undefined

      return {
        isConsistent: false,
        entity: validEntity, // Entity for potential redeployment
        error: 'Profile is not consistent across catalysts'
      }
    }

    // If consistent and we have up-to-date entities, return the entity
    if (consistencyResult.upToDateEntities && consistencyResult.upToDateEntities.length > 0) {
      const entity = consistencyResult.upToDateEntities[0]
      return {
        isConsistent: true,
        entity: entity
      }
    }

    // If no entities found, profile doesn't exist (entity will be undefined)
    return {
      isConsistent: true,
      entity: undefined
    }
  } catch (error) {
    console.error('Profile consistency check failed:', error)
    // If consistency check fails, we can't determine consistency, so redirect to onboarding
    return {
      isConsistent: false,
      error: `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export async function redeployExistingProfile(
  entity: Entity,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity
): Promise<void> {
  try {
    const PEER_URL = config.get('PEER_URL')
    const client = createContentClient({ url: PEER_URL + '/content', fetcher: createFetchComponent() })

    // Extract file hashes from entity.content
    const contentHashesByFile = entity.content.reduce((acc, next) => ({ ...acc, [next.file]: next.hash }), {} as Record<string, string>)

    // Download required assets (body.png and face256.png are typically required)
    const bodyFile = 'body.png'
    const face256File = 'face256.png'

    const [bodyBuffer, faceBuffer] = await Promise.all([
      client.downloadContent(contentHashesByFile[bodyFile]),
      client.downloadContent(contentHashesByFile[face256File])
    ])

    // Prepare files map for deployment
    const files = new Map<string, Uint8Array>()
    files.set(bodyFile, new Uint8Array(bodyBuffer))
    files.set(face256File, new Uint8Array(faceBuffer))

    // Use existing profile metadata to preserve user customizations
    const existingProfile = entity.metadata

    // Build deployment entity with fresh timestamp
    const deploymentEntity = await DeploymentBuilder.buildEntity({
      type: EntityType.PROFILE,
      pointers: [connectedAccount],
      metadata: existingProfile, // Preserve existing profile data
      timestamp: Date.now(), // Only update timestamp for fresh deployment
      files
    })

    // Deploy the profile using the user's ephemeral identity
    await client.deploy({
      entityId: deploymentEntity.entityId,
      files: deploymentEntity.files,
      authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
    })
  } catch (error) {
    console.error('Failed to redeploy existing profile:', error)
    throw error
  }
}
