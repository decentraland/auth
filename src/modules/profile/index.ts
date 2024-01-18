import { Profile } from '@dcl/schemas'
import { config } from '../config'

export async function fetchProfile(address: string): Promise<Profile | null> {
  const PEER_URL = config.get('PEER_URL')
  const response = await fetch(`${PEER_URL}/lambdas/profiles/${address}`)

  if (!response.ok) {
    return null
  }

  return await response.json()
}
