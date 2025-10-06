import { createFetchComponent } from '@well-known-components/fetch-component'
import { createLambdasClient, createContentClient } from 'dcl-catalyst-client'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { getCatalystServersFromCache } from 'dcl-catalyst-client/dist/contracts-snapshots'
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
      return {
        isConsistent: false,
        error: 'Profile is not consistent across catalysts'
      }
    }

    // If consistent and we have up-to-date entities, extract profile
    if (consistencyResult.upToDateEntities && consistencyResult.upToDateEntities.length > 0) {
      // Extract profile from the first up-to-date entity's metadata
      const entity = consistencyResult.upToDateEntities[0]
      const profile = entity.metadata as Profile
      return {
        isConsistent: true,
        profile: profile || undefined
      }
    }

    // If no entities found, profile doesn't exist
    return {
      isConsistent: true,
      profile: undefined
    }
  } catch (error) {
    // If consistency check fails, we can't determine consistency, so redirect to onboarding
    return {
      isConsistent: false,
      error: `Consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
