import { IFetchComponent } from '@well-known-components/interfaces'
import { createLambdasClient, createContentClient, DeploymentBuilder } from 'dcl-catalyst-client'
import { Profile, ProfileAvatarsItem } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { hashV1 } from '@dcl/hashing'
import { EntityType, Entity } from '@dcl/schemas'
import { createFetcher } from '../../shared/fetcher'
import { config } from '../config'

export interface ConsistencyResult {
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
  isTimeout?: boolean
}

export async function fetchProfile(address: string, fetcher?: IFetchComponent): Promise<Profile | null> {
  const PEER_URL = config.get('PEER_URL')
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher: fetcher ?? createFetcher() })
  try {
    const profile: Profile = await client.getAvatarDetails(address)
    return profile
  } catch (error) {
    return null
  }
}

export async function fetchProfileWithConsistencyCheck(address: string, fetcher?: IFetchComponent): Promise<ConsistencyResult> {
  try {
    // Determine network based on environment
    const environment = config.get('ENVIRONMENT')
    const network = environment === 'development' ? 'sepolia' : 'mainnet'

    // Get all catalyst servers for the network and remove the current peer to avoid duplicated fetches
    const catalystServers = getCatalystServersFromCache(network)
    const catalystUrls = catalystServers.map(server => `${server.address}`)

    const profileResults: (ProfileResult | ProfileResultError)[] = await Promise.all(
      catalystUrls.map(async url => {
        try {
          const client = createLambdasClient({ url: url + '/lambdas', fetcher: fetcher ?? createFetcher() })
          const profile = await client.getAvatarDetails(address)
          return { profile, url }
        } catch (error) {
          return {
            error: normalizeErrorMessage(error),
            url,
            isTimeout: isTimeoutError(error)
          }
        }
      })
    )

    const profilesWithUrls = profileResults.filter(isProfileResult)
    const profileErrors = profileResults.filter(isProfileResultError)
    const nonTimeoutErrors = profileErrors.filter(error => !error.isTimeout)

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

    const consistencyError = nonTimeoutErrors[0]
    return {
      isConsistent: consistencyError === undefined && allProfilesHaveSameTimestamp,
      profile: newest.profile,
      profileFetchedFrom: newest.url,
      error: consistencyError ? `${consistencyError.error} (${consistencyError.url})` : undefined
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
  connectedAccountIdentity: AuthIdentity,
  fetcher?: IFetchComponent
): Promise<void> {
  const snapshotUrls = Object.entries(profile.avatars?.[0]?.avatar?.snapshots ?? {}).reduce(
    (acc, [file, url]) => ({ ...acc, [file]: url }),
    {} as Record<string, string>
  )

  const [bodyBuffer, faceBuffer] = await Promise.all([
    fetch(snapshotUrls['body']).then(response => response.arrayBuffer()),
    fetch(snapshotUrls['face256']).then(response => response.arrayBuffer())
  ])

  const files = createSnapshotFilesMap(bodyBuffer, faceBuffer)
  const metadata = await buildProfileMetadata(profile, files)

  await redeployWithCatalystRotation(connectedAccount, connectedAccountIdentity, files, metadata, fetcher)
}

export async function redeployExistingProfileWithContentServerData(
  catalystUrl: string,
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  fetcher?: IFetchComponent
): Promise<void> {
  const client = createContentClient({ url: catalystUrl + '/content', fetcher: fetcher ?? createFetcher() })
  const entity = (await client.fetchEntitiesByPointers([connectedAccount]))?.[0]
  if (!entity) {
    throw new Error('Profile entity not found')
  }

  const contentHashesByFile = entity.content.reduce((acc, next) => ({ ...acc, [next.file]: next.hash }), {} as Record<string, string>)

  const [bodyBuffer, faceBuffer] = await Promise.all([
    client.downloadContent(contentHashesByFile['body.png']),
    client.downloadContent(contentHashesByFile['face256.png'])
  ])

  const files = createSnapshotFilesMap(bodyBuffer, faceBuffer)
  const metadata = buildMetadataWithEmptyWearables(entity)

  // First try to redeploy with the full content server metadata
  // If it fails, try to redeploy with the empty wearables metadata
  try {
    await redeployWithCatalystRotation(connectedAccount, connectedAccountIdentity, files, metadata, fetcher)
  } catch (error) {
    console.warn(
      'Profile redeployment failed with full content server metadata, attempting to redeploy with empty wearables metadata:',
      error
    )
    await redeployWithCatalystRotation(connectedAccount, connectedAccountIdentity, files, buildMetadataWithEmptyWearables(entity), fetcher)
  }
}

async function redeployWithCatalystRotation(
  connectedAccount: string,
  connectedAccountIdentity: AuthIdentity,
  files: Map<string, Uint8Array>,
  metadata: Partial<Profile>,
  fetcher?: IFetchComponent
): Promise<void> {
  const catalystUrls = getCatalystUrlsForRotation()
  const MAX_ATTEMPTS = Math.min(catalystUrls.length, 3)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const catalystUrl = catalystUrls[attempt]

    try {
      await attemptRedeployment(catalystUrl, connectedAccount, connectedAccountIdentity, files, metadata, fetcher)
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
  files: Map<string, Uint8Array>,
  metadata: Partial<Profile>,
  fetcher?: IFetchComponent
): Promise<void> {
  const client = createContentClient({ url: catalystUrl, fetcher: fetcher ?? createFetcher() })

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

function getCatalystUrlsForRotation(): string[] {
  const environment = config.get('ENVIRONMENT')
  const network = environment === 'development' ? 'sepolia' : 'mainnet'
  const catalystServers = getCatalystServersFromCache(network)
  const PEER_URL = config.get('PEER_URL')

  return [PEER_URL + '/content', ...catalystServers.map(server => server.address + '/content').filter(url => url !== PEER_URL + '/content')]
}

function createSnapshotFilesMap(bodyBuffer: ArrayBuffer | Buffer, faceBuffer: ArrayBuffer | Buffer): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  files.set('body.png', new Uint8Array(bodyBuffer))
  files.set('face256.png', new Uint8Array(faceBuffer))
  return files
}

export async function buildProfileMetadata(profile: Profile, files: Map<string, Uint8Array>): Promise<Partial<Profile>> {
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

function buildMetadataWithEmptyWearables(entity: Entity): Partial<Profile> {
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

const TIMEOUT_STATUS_CODE = 408

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

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }

  if (typeof error === 'object' && error !== null) {
    const maybeStatus = (error as { status?: number }).status
    if (maybeStatus === TIMEOUT_STATUS_CODE) {
      return true
    }
  }

  const message = normalizeErrorMessage(error)
  return (
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('request timeout') ||
    message.toLowerCase().includes('aborted') ||
    message.toLowerCase().includes('status 408')
  )
}

function isProfileResult(result: ProfileResult | ProfileResultError): result is ProfileResult {
  return 'profile' in result
}

function isProfileResultError(result: ProfileResult | ProfileResultError): result is ProfileResultError {
  return 'error' in result
}
