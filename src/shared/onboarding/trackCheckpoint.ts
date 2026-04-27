import { getAnalytics } from '../../modules/analytics/segment'

type CheckpointParams = {
  checkpointId: number
  action?: 'reached' | 'completed'
  userIdentifier?: string
  identifierType?: 'anon' | 'email' | 'wallet'
  email?: string
  wallet?: string
  source?: 'auth' | 'landing' | 'explorer'
  metadata?: Record<string, unknown>
}

/**
 * Sends an Onboarding Checkpoint event to Segment. The user_id is the
 * Segment anonymousId by default — landing and auth share the same domain
 * (`decentraland.org`) so the cookie carries the same id end-to-end.
 *
 * Callers can override `userIdentifier`/`identifierType` after auth completes
 * (when wallet/email become known), but the anonymousId stays the canonical
 * link with CP1 (landing) and CP3 (Explorer via campaign_anon_user_id).
 */
export function trackCheckpoint(params: CheckpointParams): void {
  const analytics = getAnalytics()
  if (!analytics) return

  const anonymousId = analytics.user().anonymousId() as string | undefined
  const userIdentifier = params.userIdentifier ?? anonymousId
  const identifierType = params.identifierType ?? (anonymousId ? 'anon' : undefined)

  if (!userIdentifier || !identifierType) return

  analytics.track('Onboarding Checkpoint', {
    checkpointId: params.checkpointId,
    action: params.action ?? 'reached',
    userIdentifier,
    identifierType,
    email: params.email,
    wallet: params.wallet,
    source: params.source ?? 'auth',
    metadata: params.metadata
  })
}
