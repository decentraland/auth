import { createFetchComponent } from '@well-known-components/fetch-component'
import { createLambdasClient, createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Profile, ProfileAvatarsItem } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { hashV1 } from '@dcl/hashing'
import { EntityType, Entity } from '@dcl/schemas'
import { config } from '../config'

export interface ConsistencyResult {
  isConsistent: boolean
  profile?: Profile
  profileFetchedFrom?: string
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

    // Get all catalyst servers for the network and remove the current peer to avoid duplicated fetches
    const catalystServers = getCatalystServersFromCache(network)
    const catalystUrls = catalystServers.map(server => `${server.address}`)

    const profileResults = await Promise.all(
      catalystUrls.map(async url => {
        try {
          const client = createLambdasClient({ url: url + '/lambdas', fetcher: createFetchComponent() })
          const profile = await client.getAvatarDetails(address)
          return { profile, url }
        } catch {
          // Profile doesn't exist on this catalyst (404) or fetch failed
          return null
        }
      })
    )

    const profilesWithUrls = profileResults.filter(result => result !== null)

    if (profilesWithUrls.length === 0) {
      return {
        isConsistent: false,
        error: 'No profiles found'
      }
    }

    const allProfilesExist = profilesWithUrls.length === catalystUrls.length
    const allProfilesHaveSameTimestamp =
      profilesWithUrls.every(({ profile }) => profile.timestamp === profilesWithUrls[0]?.profile.timestamp) && false

    const newest = profilesWithUrls.reduce((acc, current) => {
      return (acc.profile.timestamp ?? 0) > (current.profile.timestamp ?? 0) ? acc : current
    }, profilesWithUrls[0])

    return {
      isConsistent: allProfilesExist && allProfilesHaveSameTimestamp,
      profile: newest.profile,
      profileFetchedFrom: newest.url
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
  profile: Profile,
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
      await attemptRedeployment(profile, connectedAccount, connectedAccountIdentity, catalystUrl)
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
  profile: Profile,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  catalystUrl: string
): Promise<void> {
  const client = createContentClient({ url: catalystUrl, fetcher: createFetchComponent() })

  // Extract file urls from avatar snapshots
  const contentUrlsByFile = Object.entries(profile.avatars?.[0]?.avatar?.snapshots ?? {}).reduce(
    (acc, [file, url]) => ({ ...acc, [file]: url }),
    {} as Record<string, string>
  )

  // Download required assets (body.png and face256.png are typically required)
  const bodyFile = 'body'
  const face256File = 'face256'

  const [bodyBuffer, faceBuffer] = await Promise.all([
    fetch(contentUrlsByFile[bodyFile]).then(response => response.arrayBuffer()),
    fetch(contentUrlsByFile[face256File]).then(response => response.arrayBuffer())
  ])

  // Prepare files map for deployment
  const files = new Map<string, Uint8Array>()
  files.set(`${bodyFile}.png`, new Uint8Array(bodyBuffer))
  files.set(`${face256File}.png`, new Uint8Array(faceBuffer))

  // Build profile metadata with fresh snapshots
  const metadata = await buildProfileMetadata(profile, files)

  // Build deployment entity with fresh timestamp
  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata,
    timestamp: Date.now(),
    files
  })

  // Deploy the profile using the user's ephemeral identity
  await client.deploy({
    entityId: deploymentEntity.entityId,
    files: deploymentEntity.files,
    authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
  })
}

export async function buildProfileMetadata(profile: Profile, files: Map<string, Uint8Array>): Promise<Partial<Profile>> {
  // Build snapshots object with fresh hashes
  const adaptSnapshot = async ([file, content]: [string, Uint8Array]) => [file.replace('.png', ''), await hashV1(content)]
  const snapshots = Object.fromEntries(await Promise.all(Array.from(files.entries()).map(adaptSnapshot)))

  return {
    avatars: profile.avatars?.map(avatar => ({
      ...avatar,
      avatar: {
        ...avatar.avatar,
        snapshots
      }
    }))
  }
}

export async function redeployExistingProfileWithContentServerData(
  catalystUrl: string,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity
): Promise<void> {
  const client = createContentClient({ url: catalystUrl + '/content', fetcher: createFetchComponent() })

  // Download profile entity from content server
  const entity = (await client.fetchEntitiesByPointers([connectedAccount]))?.[0]
  if (!entity) {
    throw new Error('Profile entity not found')
  }

  // Download required assets (body.png and face256.png are typically required)
  const bodyFile = 'body.png'
  const face256File = 'face256.png'

  // Extract file hashes from entity.content
  const contentHashesByFile = entity.content.reduce((acc, next) => ({ ...acc, [next.file]: next.hash }), {} as Record<string, string>)

  const [bodyBuffer, faceBuffer] = await Promise.all([
    client.downloadContent(contentHashesByFile[bodyFile]),
    client.downloadContent(contentHashesByFile[face256File])
  ])

  const files = new Map<string, Uint8Array>()
  files.set(`${bodyFile}`, new Uint8Array(bodyBuffer))
  files.set(`${face256File}`, new Uint8Array(faceBuffer))

  const metadata = await buildMetadataWithEmptyWearables(entity)

  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata,
    timestamp: Date.now(),
    files
  })

  await client.deploy({
    entityId: deploymentEntity.entityId,
    files: deploymentEntity.files,
    authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
  })
}

async function buildMetadataWithEmptyWearables(entity: Entity): Promise<Partial<Profile>> {
  return {
    avatars: entity.metadata?.avatars?.map((avatar: ProfileAvatarsItem) => ({
      ...avatar,
      avatar: {
        ...avatar.avatar,
        wearables: []
      }
    }))
  }
}

function isRetryableHttpError(error: unknown): boolean {
  // Only retry on 5xx server errors or network issues
  // Don't retry on 4xx client errors (bad request, auth issues, etc.)

  if (!error) return true // Unknown error, try next catalyst

  // Try to extract status code from various error formats
  const errorObj = error as { status?: number; statusCode?: number; response?: { status: number } }
  const statusCode = errorObj?.status || errorObj?.statusCode || errorObj?.response?.status

  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return false
  }

  // For all other errors (network, parsing, etc.), try next catalyst
  return true
}
