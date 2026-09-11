import { IFetchComponent } from '@well-known-components/interfaces'
import { DeploymentBuilder, createContentClient, createLambdasClient } from 'dcl-catalyst-client'
import { Profile, ProfileAvatarsItem } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { AuthIdentity, Authenticator } from '@dcl/crypto'
import { Entity, EntityType } from '@dcl/schemas'
import { createFetcher } from '../../shared/fetcher'
import { formatUntrustedLabel } from '../../shared/text'
import { config } from '../config'
import { deployWithCatalystRotation } from './deploy'
import { DeploymentError } from './errors'
import { getCatalystServers, getCatalystUrlsForRotation } from './utils'

interface ConsistencyResult {
  isConsistent: boolean
  profile?: Profile
  profileFetchedFrom?: string
  error?: string
  // True when the check could not reach a conclusion because every catalyst request failed
  // transiently (network error / timeout / 5xx) — as opposed to authoritatively reporting the
  // profile is missing. Callers must NOT treat this as "no profile" (which would route an
  // existing user into onboarding and overwrite their real profile with a default one).
  couldNotDetermine?: boolean
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

interface FetchProfileResult {
  // The profile if one was authoritatively found, otherwise null.
  profile: Profile | null
  // True when the request failed transiently (network error / timeout / non-not-found body) so we
  // could NOT determine whether a profile exists. Callers that guard against overwriting an
  // existing profile must treat this as "might exist", NOT as "no profile".
  couldNotDetermine: boolean
}

async function fetchProfileWithStatus(address: string, fetcher?: IFetchComponent): Promise<FetchProfileResult> {
  const PEER_URL = config.get('PEER_URL')
  // Bound the request with a timeout by default (matching the consistency-check path) so the
  // setup-page onboarding guard that calls this can't pin the user on a loading state for minutes
  // when a catalyst stalls — a timeout surfaces as couldNotDetermine, which callers already handle.
  const defaultFetcher = createFetcher({ timeout: Number(config.get('PROFILE_CONSISTENCY_CHECK_TIMEOUT')) || 10000 })
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher: fetcher ?? defaultFetcher })
  try {
    const profile: Profile = await client.getAvatarDetails(address)
    // The catalyst client does not throw on non-OK responses (e.g. 404); it parses the body
    // regardless of status. A real 404 returns a not-found body — that is an authoritative
    // "no profile". Any other non-profile body is indeterminate (don't treat as "no profile").
    if (!profile.avatars) {
      return { profile: null, couldNotDetermine: !isNotFoundResponse(profile) }
    }
    return { profile, couldNotDetermine: false }
  } catch {
    // Network error / timeout / 5xx — we cannot tell whether the profile exists.
    return { profile: null, couldNotDetermine: true }
  }
}

/**
 * The profile of one address, for showing next to that address.
 *
 * Two things are required of the answer that `fetchProfileWithStatus` does not require, because they
 * matter when a name is put on screen beside an address and not when deciding whether a user needs
 * onboarding:
 *
 * - it must be that address's. The endpoint is asked about one address and its answer is read as being
 *   about that address; a response that reports another one — a mixed-up cache, a compromised catalyst —
 *   would otherwise pair a real recipient with an unrelated identity, which is exactly what a name shown
 *   beside an address is trusted not to do. A profile that reports no address at all is refused for the
 *   same reason: it is not evidence about anyone (see fetchProfiles, which attributes the same way).
 * - the name must be safe to display. It is free text the profile's owner wrote, with no length or
 *   character limit in the schema, and it lands on a screen whose other lines are the amount and the
 *   recipient. Formatted once here, where the profile enters the app, so no consumer can render the raw
 *   value — including decentraland-ui2's Profile, which renders the name it is handed.
 *
 * Both are refusals of the profile, never of the request: the screens fall back to naming the account by
 * its address, which is what they show for an address that has no profile at all.
 */
async function fetchProfile(address: string, fetcher?: IFetchComponent): Promise<Profile | null> {
  const { profile } = await fetchProfileWithStatus(address, fetcher)
  if (!profile) return null
  const avatars = profile.avatars ?? []
  const requested = address.toLowerCase()
  const owned = avatars.filter(avatar => (avatar.ethAddress ?? avatar.userId)?.toLowerCase() === requested)
  if (owned.length === 0) return null
  return { ...profile, avatars: owned.map(avatar => ({ ...avatar, name: formatUntrustedLabel(avatar.name) })) }
}

/**
 * How many addresses go in one bulk request. The lambdas bulk endpoints document a 500-id ceiling for
 * their other collections, and this one states none, so it is chunked well under that rather than trusting
 * an undocumented limit — a server that silently answered for a prefix would look exactly like the
 * addresses having no profile.
 */
const PROFILES_PER_REQUEST = 100

/** How many of those requests are in flight at once. Each answer carries whole profiles, not just names. */
const PROFILE_REQUEST_CONCURRENCY = 3

/**
 * The profiles for many addresses, keyed by lowercased address, using the lambdas bulk endpoint — one
 * request per hundred addresses instead of one per address.
 *
 * Results are attributed by the address each profile reports (`ethAddress`, or `userId` when it does not),
 * never by position: the endpoint answers with the profiles that exist, so an address without one is
 * absent from the array and matching by index would hand a name to the wrong account. A profile that
 * reports no address at all is dropped for the same reason.
 *
 * A failed chunk resolves to no names for its addresses rather than rejecting: names are progressive
 * enhancement, and one unlucky request should not cost the others theirs.
 */
async function fetchProfiles(addresses: string[], fetcher?: IFetchComponent): Promise<Map<string, Profile>> {
  const PEER_URL = config.get('PEER_URL')
  const defaultFetcher = createFetcher({ timeout: Number(config.get('PROFILE_CONSISTENCY_CHECK_TIMEOUT')) || 10000 })
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher: fetcher ?? defaultFetcher })

  const chunks: string[][] = []
  for (let index = 0; index < addresses.length; index += PROFILES_PER_REQUEST) {
    chunks.push(addresses.slice(index, index + PROFILES_PER_REQUEST))
  }

  const byAddress = new Map<string, Profile>()
  const queue = [...chunks]
  const worker = async () => {
    for (;;) {
      const chunk = queue.shift()
      if (chunk === undefined) return
      try {
        const profiles = await client.getAvatarsDetailsByPost({ ids: chunk })
        for (const profile of profiles) {
          const [avatar] = profile.avatars ?? []
          const owner = avatar?.ethAddress ?? avatar?.userId
          if (!owner) continue
          byAddress.set(owner.toLowerCase(), profile)
        }
      } catch {
        // No names for this chunk; its rows keep their addresses.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PROFILE_REQUEST_CONCURRENCY, queue.length) }, worker))
  return byAddress
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

    // Get all catalyst servers for the network (excluding any disabled ones) to cross-check the
    // profile across catalysts.
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
      // No catalyst returned a profile. Only conclude "the user has no profile" when at least
      // one catalyst authoritatively said so (a 404 / not-found body). If every request failed
      // transiently (no not-found responses at all), we cannot tell whether the profile exists —
      // surfacing this as "no profile" during a catalyst outage would send an existing user to
      // onboarding and overwrite their profile. Signal the indeterminate state instead.
      if (notFoundErrors.length === 0) {
        return {
          isConsistent: false,
          couldNotDetermine: true,
          error: 'Profile consistency check could not reach any catalyst'
        }
      }

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
    // The whole check threw (e.g. catalyst discovery failed). We can't determine whether the
    // user has a profile, so mark it indeterminate rather than treating it as "no profile" —
    // callers must not onboard/overwrite an existing user on the basis of an infrastructure error.
    return {
      isConsistent: false,
      couldNotDetermine: true,
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
  fetchProfiles,
  fetchProfileWithStatus,
  fetchProfileWithConsistencyCheck,
  getCatalystUrlsForRotation,
  redeployExistingProfile,
  redeployExistingProfileWithContentServerData
}
export { deployWithCatalystRotation } from './deploy'
export { DeploymentError, ProfileFetchError } from './errors'
export type { ConsistencyResult, FetchProfileResult }
