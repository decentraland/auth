import { AuthIdentity } from '@dcl/crypto'
import { config } from '../../../modules/config'

type TestAuthVerifyResult = {
  identity: AuthIdentity
  address: string
}

function isTestAuthEmail(email: string): boolean {
  const testDomain = config.get('TEST_AUTH_EMAIL_DOMAIN')
  if (!testDomain) return false
  return email.endsWith(`@${testDomain}`)
}

async function sendTestAuthCode(email: string): Promise<boolean> {
  const bffUrl = config.get('MOBILE_BFF_URL')
  const response = await fetch(`${bffUrl}/test-auth/send-code`, {
    method: 'POST',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })

  if (response.status === 403) return false

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to send test auth code')
  }

  return true
}

async function verifyTestAuthCode(email: string, code: string): Promise<TestAuthVerifyResult> {
  const bffUrl = config.get('MOBILE_BFF_URL')
  const response = await fetch(`${bffUrl}/test-auth/verify-code`, {
    method: 'POST',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  })

  if (!response.ok) {
    let message = 'Failed to verify test auth code'
    try {
      const data = await response.json()
      message = data.error || message
    } catch {
      // Non-JSON error body (e.g., gateway 502)
    }
    const error: Error & { skipReporting?: boolean } = new Error(message)
    if (response.status === 401) {
      error.skipReporting = true
    }
    throw error
  }

  const data = await response.json()
  return data.data as TestAuthVerifyResult
}

export { isTestAuthEmail, sendTestAuthCode, verifyTestAuthCode }
export type { TestAuthVerifyResult }
