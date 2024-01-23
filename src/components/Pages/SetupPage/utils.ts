import { config } from '../../../modules/config'

export async function subscribeToNewsletter(email: string) {
  const url = config.get('BUILDER_SERVER_URL', '') + '/v1/newsletter'

  const response = await fetch(url, {
    method: 'post',
    body: JSON.stringify({ email, source: 'auth' }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'content-type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Could not subscribe to newsletter. Status: ${response.status}`)
  }
}
