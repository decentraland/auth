import { createFetchComponent } from '@well-known-components/fetch-component'
import { createLambdasClient, createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Profile, ProfileAvatarsItemAvatarSnapshots } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { EntityType } from '@dcl/schemas'
import { config } from '../config'

export interface ConsistencyResult {
  isConsistent: boolean
  profile?: Profile
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
    const catalystUrls = catalystServers.map(server => `${server.address}/lambdas`)

    const profiles = await Promise.all(
      catalystUrls.map(url => {
        const client = createLambdasClient({ url, fetcher: createFetchComponent() })
        return client.getAvatarDetails(address)
      })
    )

    if (profiles.length === 0) {
      return {
        isConsistent: false,
        error: 'No profiles found'
      }
    }

    const allProfilesExist = profiles.length === catalystUrls.length
    const allProfilesHaveSameTimestamp = profiles.every(profile => profile.timestamp === profiles[0]?.timestamp)

    const newestProfile = profiles.reduce((acc, profile) => {
      return (acc.timestamp ?? 0) > (profile.timestamp ?? 0) ? acc : profile
    }, profiles[0])

    return {
      isConsistent: allProfilesExist && allProfilesHaveSameTimestamp,
      profile: newestProfile,
      error: undefined
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

  // Extract file hashes from entity.content
  // Extract profile snapshot files
  const contentHashesByFile = Object.entries(profile.avatars?.[0]?.avatar?.snapshots ?? {}).reduce(
    (acc, [file, hash]) => ({ ...acc, [file]: hash }),
    {} as Record<string, string>
  )

  // Download required assets (body.png and face256.png are typically required)
  const bodyFile = 'body'
  const face256File = 'face256'

  const [bodyBuffer, faceBuffer] = await Promise.all([
    client.downloadContent(extractHash(contentHashesByFile[bodyFile])),
    client.downloadContent(extractHash(contentHashesByFile[face256File]))
  ])

  // Prepare files map for deployment
  const files = new Map<string, Uint8Array>()
  files.set(`${bodyFile}.png`, new Uint8Array(bodyBuffer))
  files.set(`${face256File}.png`, new Uint8Array(faceBuffer))

  // Build deployment entity with fresh timestamp
  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata: buildProfileMetadata(profile), // Preserve existing profile data
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

function extractHash(snapshotUrl: string): string {
  const hash = snapshotUrl.match(/\/entities\/([a-z0-9]+)\//)?.[1]
  if (!hash) {
    throw new Error('Invalid snapshot URL')
  }
  return hash
}

export function buildProfileMetadata(profile: Profile): Partial<Profile> {
  return {
    avatars: profile.avatars?.map(avatar => ({
      ...avatar,
      avatar: {
        ...avatar.avatar,
        snapshots: Object.entries(avatar.avatar?.snapshots ?? {}).reduce(
          (acc, [key, url]) => ({ ...acc, [key]: extractHash(url) }),
          {} as ProfileAvatarsItemAvatarSnapshots
        )
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
