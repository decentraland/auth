import { createFetchComponent } from '@well-known-components/fetch-component'
import { createLambdasClient } from 'dcl-catalyst-client'
import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { config } from '../config'

export async function fetchProfile(address: string): Promise<Profile | null> {
  const PEER_URL = config.get('PEER_URL')
  const client = createLambdasClient({ url: PEER_URL + '/lambdas', fetcher: createFetchComponent() })
  try {
    const profile = await client.getAvatarDetails(address)
    return profile
  } catch (error) {
    return null
  }
}
