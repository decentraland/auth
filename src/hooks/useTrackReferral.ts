import { useCallback } from 'react'
import fetch from 'decentraland-crypto-fetch'
import { config } from '../modules/config'
import { useCurrentConnectionData } from '../shared/connection/hook'
import { handleErrorWithContext } from '../shared/utils/errorHandler'

const REFERRAL_SERVER_URL = config.get('REFERRAL_SERVER_URL')

export const useTrackReferral = () => {
  const { identity, account } = useCurrentConnectionData()

  const track = useCallback(
    async (referrer: string, method: 'POST' | 'PATCH' = 'POST') => {
      if (!identity) {
        throw new Error('No identity available for tracking referral')
      }

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
    },
    [identity, account]
  )

  return {
    track,
    isReady: !!identity
  }
}
