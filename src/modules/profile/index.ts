import { IFetchComponent } from '@well-known-components/interfaces'
import { DeploymentBuilder, createContentClient, createLambdasClient } from 'dcl-catalyst-client'
import { Profile, ProfileAvatarsItem } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { Entity, EntityType } from '@dcl/schemas'
import { createFetcher } from '../../shared/fetcher'
import { config } from '../config'
import { deployWithCatalystRotation } from './deploy'
import { DeploymentError } from './errors'
import { getCatalystServers, getCatalystUrlsForRotation } from './utils'

interface ConsistencyResult {
  isConsistent: boolean
  profile?: Profile
  profileFetchedFrom?: string
  error?: string
}

interface ProfileResult {
  profile: Profile
  url: string
}

interface ProfileResultError {
  error: string
  url: string
  isNotFound?: boolean
}

async function fetchProfile(address: string, fetcher?: IFetchComponent): Promise<Profile | null> {
  const PEER_URL = config.get('PEER_URL')
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher: fetcher ?? createFetcher() })
  try {
    const profile: Profile = await client.getAvatarDetails(address)
    // The catalyst client does not throw on non-OK responses (e.g. 404).
    // Validate that the response is actually a profile.
    if (!profile.avatars) {
      return null
    }
    return profile
  } catch {
    return null
  }
}

async function fetchProfileWithConsistencyCheck(
  address: string,
  disabledCatalysts: string[],
  fetcher?: IFetchComponent
): Promise<ConsistencyResult> {
  try {
    // Determine network based on environment
    const environment = config.get('ENVIRONMENT')
    const network = environment === 'development' ? 'sepolia' : 'mainnet'

    // Get all catalyst servers for the network and remove the current peer to avoid duplicated fetches
    const catalystServers = getCatalystServers(network, disabledCatalysts)
    const catalystUrls = catalystServers.map(server => `${server.address}`)

    const profileResults: (ProfileResult | ProfileResultError)[] = await Promise.all(
      catalystUrls.map(async url => {
        try {
          const client = createLambdasClient({ url: url + '/lambdas', fetcher: fetcher ?? createFetcher() })
          const profile = await client.getAvatarDetails(address)
          // The catalyst client does not throw on non-OK responses (e.g. 404).
          // It parses the JSON body regardless of status, so a 404 returns
          // { error: "Not Found", message: "Profile not found" } instead of throwing.
          // We must validate that the response is actually a profile.
          if (!profile.avatars) {
            return { error: 'Profile not found', url, isNotFound: isNotFoundResponse(profile) }
          }
          return { profile, url }
        } catch (error) {
          // Exceptions (network errors, timeouts, 500s) are not "not found"
          return {
            error: normalizeErrorMessage(error),
            url
          }
        }
      })
    )

    const profilesWithUrls = profileResults.filter(isProfileResult)
    const profileErrors = profileResults.filter(isProfileResultError)
    const notFoundErrors = profileErrors.filter(error => error.isNotFound)

    if (profilesWithUrls.length === 0) {
      return {
        isConsistent: false,
        error: 'No profiles found'
      }
    }

    const firstProfile = profilesWithUrls[0]
    const allProfilesHaveSameTimestamp = profilesWithUrls.every(
      profileWithUrl => profileWithUrl.profile.timestamp === firstProfile.profile.timestamp
    )

    const newest = profilesWithUrls.reduce((acc, current) => {
      return (acc?.profile?.timestamp ?? 0) > (current?.profile?.timestamp ?? 0) ? acc : current
    }, firstProfile)

    return {
      isConsistent: allProfilesHaveSameTimestamp && notFoundErrors.length === 0,
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

async function redeployExistingProfile(
  profile: Profile,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  disabledCatalysts: string[] = []
): Promise<void> {
  // Don't redeploy snapshot files, remove snapshot references from avatar
  const metadata = buildProfileMetadataWithoutSnapshots(profile)

  const deploymentEntity = await DeploymentBuilder.buildEntity({
    type: EntityType.PROFILE,
    pointers: [connectedAccount],
    metadata,
    timestamp: Date.now()
  })

  await deployWithCatalystRotation({
    entity: {
      entityId: deploymentEntity.entityId,
      files: deploymentEntity.files,
      authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
    },
    disabledCatalysts
  })
}

async function redeployExistingProfileWithContentServerData(
  catalystUrl: string,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  disabledCatalysts: string[] = []
): Promise<void> {
  const client = createContentClient({ url: catalystUrl + '/content', fetcher: createFetcher() })
  const entity = (await client.fetchEntitiesByPointers([connectedAccount]))?.[0]
  if (!entity) {
    throw new Error('Profile entity not found')
  }

  // Don't redeploy snapshot files, remove snapshot references from avatar
  const metadata = buildProfileMetadataWithoutSnapshots(entity.metadata as Profile)

  const buildEntityAndDeploy = async (profileMetadata: Partial<Profile>) => {
    const deploymentEntity = await DeploymentBuilder.buildEntity({
      type: EntityType.PROFILE,
      pointers: [connectedAccount],
      metadata: profileMetadata,
      timestamp: Date.now()
    })

    await deployWithCatalystRotation({
      entity: {
        entityId: deploymentEntity.entityId,
        files: deploymentEntity.files,
        authChain: Authenticator.signPayload(connectedAccountIdentity, deploymentEntity.entityId)
      },
      disabledCatalysts
    })
  }

  // First try to redeploy with the full content server metadata
  // If it fails with a non-400 error, try to redeploy with the empty wearables metadata
  try {
    await buildEntityAndDeploy(metadata)
  } catch (error) {
    if (error instanceof DeploymentError && error.statusCode === 400) {
      throw error
    }

    console.warn(
      'Profile redeployment failed with full content server metadata, attempting to redeploy with empty wearables metadata:',
      error
    )
    await buildEntityAndDeploy(buildMetadataWithEmptyWearables(entity))
  }
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

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function isProfileResult(result: ProfileResult | ProfileResultError): result is ProfileResult {
  return 'profile' in result
}

function isProfileResultError(result: ProfileResult | ProfileResultError): result is ProfileResultError {
  return 'error' in result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNotFoundResponse(response: any): boolean {
  const error = response?.error
  const message = response?.message
  return (
    (typeof error === 'string' && error.toLowerCase().includes('not found')) ||
    (typeof message === 'string' && message.toLowerCase().includes('not found'))
  )
}

export {
  fetchProfile,
  fetchProfileWithConsistencyCheck,
  getCatalystUrlsForRotation,
  redeployExistingProfile,
  redeployExistingProfileWithContentServerData
}
export { deployWithCatalystRotation } from './deploy'
export { DeploymentError } from './errors'
export type { ConsistencyResult }
