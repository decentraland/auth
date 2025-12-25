import { createLambdasClient, createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Profile, ProfileAvatarsItem } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { EntityType, Entity } from '@dcl/schemas'
import { fetcher } from '../../shared/fetcher'
import { config } from '../config'

export interface ConsistencyResult {
  isConsistent: boolean
  profile?: Profile
  profileFetchedFrom?: string
  error?: string
}

export async function fetchProfile(address: string): Promise<Profile | null> {
  const PEER_URL = config.get('PEER_URL')
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher })
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
          const client = createLambdasClient({ url: url + '/lambdas', fetcher: fetcher })
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
    const firstProfile = profilesWithUrls[0]!
    const allProfilesHaveSameTimestamp = profilesWithUrls.every(
      profileWithUrl => profileWithUrl?.profile?.timestamp === firstProfile.profile.timestamp
    )

    const newest = profilesWithUrls.reduce((acc, current) => {
      return (acc?.profile?.timestamp ?? 0) > (current?.profile?.timestamp ?? 0) ? acc : current
    }, firstProfile)

    return {
      isConsistent: allProfilesExist && allProfilesHaveSameTimestamp,
      profile: newest?.profile,
      profileFetchedFrom: newest?.url
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
  // Don't redeploy snapshot files, remove snapshot references from avatar
  const metadata = buildProfileMetadataWithoutSnapshots(profile)

  await redeployWithCatalystRotation(connectedAccount, connectedAccountIdentity, metadata)
}

export async function redeployExistingProfileWithContentServerData(
  catalystUrl: string,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity
): Promise<void> {
  const client = createContentClient({ url: catalystUrl + '/content', fetcher: fetcher })
  const entity = (await client.fetchEntitiesByPointers([connectedAccount]))?.[0]
  if (!entity) {
    throw new Error('Profile entity not found')
  }

  // Don't redeploy snapshot files, remove snapshot references from avatar
  const metadata = buildMetadataWithEmptyWearables(entity)

  await redeployWithCatalystRotation(connectedAccount, connectedAccountIdentity, metadata)
}

async function redeployWithCatalystRotation(
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  metadata: Partial<Profile>
): Promise<void> {
  const catalystUrls = getCatalystUrlsForRotation()
  const MAX_ATTEMPTS = Math.min(catalystUrls.length, 3)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const catalystUrl = catalystUrls[attempt]

    try {
      await attemptRedeployment(catalystUrl, connectedAccount, connectedAccountIdentity, metadata)
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
  catalystUrl: string,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  metadata: Partial<Profile>
): Promise<void> {
  const client = createContentClient({ url: catalystUrl, fetcher: fetcher })

  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata,
    timestamp: Date.now()
  })

  await client.deploy({
    entityId: deploymentEntity.entityId,
    files: deploymentEntity.files,
    authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
  })
}

function getCatalystUrlsForRotation(): string[] {
  const environment = config.get('ENVIRONMENT')
  const network = environment === 'development' ? 'sepolia' : 'mainnet'
  const catalystServers = getCatalystServersFromCache(network)
  const PEER_URL = config.get('PEER_URL')

  return [PEER_URL + '/content', ...catalystServers.map(server => server.address + '/content').filter(url => url !== PEER_URL + '/content')]
}

function buildProfileMetadataWithoutSnapshots(profile: Profile): Partial<Profile> {
  // Remove snapshots property entirely from the avatar
  return {
    avatars: profile.avatars?.map(avatar => {
      const { snapshots, ...avatarWithoutSnapshots } = avatar.avatar ?? {}
      return {
        ...avatar,
        avatar: avatarWithoutSnapshots
      }
    })
  }
}

function buildMetadataWithEmptyWearables(entity: Entity): Partial<Profile> {
  return {
    avatars: entity.metadata?.avatars?.map((avatar: ProfileAvatarsItem) => {
      const { snapshots, ...avatarWithoutSnapshots } = avatar.avatar ?? {}
      return {
        ...avatar,
        avatar: {
          ...avatarWithoutSnapshots,
          wearables: []
        }
      }
    })
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
