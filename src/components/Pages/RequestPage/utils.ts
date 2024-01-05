import { config } from '../../../modules/config'

export async function fetchProfile(address: string) {
  const PEER_URL = config.get('PEER_URL')
  const response = await fetch(`${PEER_URL}/content/entities/profile?pointer=${address}`)
  if (response.ok) {
    return await response.json()
  }
  return []
}
