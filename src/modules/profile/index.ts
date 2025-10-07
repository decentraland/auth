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
  // Get all available catalyst servers for rotation
  const environment = config.get('ENVIRONMENT')
  const network = environment === 'development' ? 'sepolia' : 'mainnet'
  const catalystServers = getCatalystServersFromCache(network)

  // Prepare catalyst URLs for rotation, starting with the current PEER_URL
  const PEER_URL = config.get('PEER_URL')
  const catalystUrls = [
    PEER_URL + '/content',
    ...catalystServers.map(server => server.address + '/content').filter(url => url !== PEER_URL + '/content')
  ]

  const MAX_ATTEMPTS = Math.min(catalystUrls.length, 3) // Try up to 3 catalysts or all available

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const catalystUrl = catalystUrls[attempt]

    try {
      await attemptRedeployment(entity, connectedAccount, connectedAccountIdentity, catalystUrl)
      // If successful, exit the retry loop
      console.log(`Profile redeployment successful using catalyst: ${catalystUrl}`)
      return
    } catch (error) {
      const isLastAttempt = attempt === MAX_ATTEMPTS - 1
      const shouldRetry = isLastAttempt ? false : isRetryableHttpError(error)

      console.warn(`Profile redeployment failed on catalyst ${catalystUrl} (attempt ${attempt + 1}/${MAX_ATTEMPTS}):`, error)

      if (isLastAttempt || !shouldRetry) {
        if (isLastAttempt) {
          console.error('Profile redeployment failed on all available catalysts')
        }
        throw error
      }

      // Small delay before trying next catalyst
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
}

async function attemptRedeployment(
  entity: Entity,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  catalystUrl: string
): Promise<void> {
  const client = createContentClient({ url: catalystUrl, fetcher: createFetchComponent() })

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
}

function isRetryableHttpError(error: unknown): boolean {
  // Only retry on 5xx server errors or network issues
  // Don't retry on 4xx client errors (bad request, auth issues, etc.)

  if (!error) return true // Unknown error, try next catalyst

  // Try to extract status code from various error formats
  const errorObj = error as any
  const statusCode = errorObj?.status || errorObj?.statusCode || errorObj?.response?.status

  if (typeof statusCode === 'number') {
    // Don't retry on 4xx client errors (400-499) - these are likely permanent
    if (statusCode >= 400 && statusCode < 500) {
      return false
    }
    // Retry on 5xx server errors (500-599) - these might work on another catalyst
    if (statusCode >= 500) {
      return true
    }
  }

  // For all other errors (network, parsing, etc.), try next catalyst
  return true
}
