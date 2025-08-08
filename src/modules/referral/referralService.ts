import fetch, { AuthIdentity } from 'decentraland-crypto-fetch'
import { handleErrorWithContext } from '../../shared/utils/errorHandler'
import { config } from '../config'

const REFERRAL_SERVER_URL = config.get('REFERRAL_SERVER_URL')

const trackReferralProgress = async (referrer: string, identity: AuthIdentity, method: 'POST' | 'PATCH' = 'POST', account?: string) => {
  try {
    const body = method === 'POST' ? JSON.stringify({ referrer }) : undefined

    await fetch(`${REFERRAL_SERVER_URL}/referral-progress`, {
      method,
      headers: {
        contentType: 'application/json'
      },
      ...(body && { body }),
      identity
    })
  } catch (error) {
    handleErrorWithContext(error, 'Failed to track referral progress', {
      feature: 'referral-progress',
      account,
      referrer,
      url: REFERRAL_SERVER_URL
    })
    throw error
  }
}

export { trackReferralProgress }
