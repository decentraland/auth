import { Profile } from 'dcl-catalyst-client/dist/client/specs/catalyst.schemas'
import { config } from '../config'

export async function fetchProfile(address: string): Promise<Profile | null> {
  const ASSET_BUNDLE_REGISTRY_URL = config.get('ASSET_BUNDLE_REGISTRY_URL')

  try {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const response = await fetch(`${ASSET_BUNDLE_REGISTRY_URL}/profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: [address] })
    })

    if (!response.ok) return null

    const profiles: Profile[] = await response.json()
    return profiles[0] ?? null
  } catch (error) {
    return null
  }
}
