import { getStoredEmail } from './getStoredEmail'
import { trackCheckpoint } from './trackCheckpoint'

/**
 * Marks CP2 as completed for returning users (those with an existing profile).
 * Prevents nudge emails being sent to people who are already onboarded.
 * Fires with wallet address AND email (if available) so both identifier types are covered.
 */
export function markReturningUser(account: string) {
  const storedEmail = getStoredEmail()
  if (storedEmail) {
    trackCheckpoint({
      checkpointId: 2,
      action: 'completed',
      userIdentifier: storedEmail,
      identifierType: 'email',
      wallet: account.toLowerCase()
    })
  }
  trackCheckpoint({
    checkpointId: 2,
    action: 'completed',
    userIdentifier: account,
    identifierType: 'wallet',
    wallet: account.toLowerCase()
  })
}
