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
 * Reads the anonymousId from analytics.js. Wrapped in try/catch because the
 * stub queue created by the Segment snippet can shadow `user()` until the
 * real library finishes loading, in which case `analytics.user().anonymousId()`
 * throws TypeError. Returns undefined on any failure.
 */
function safeAnonymousId(): string | undefined {
  try {
    const analytics = getAnalytics()
    const id = analytics?.user?.()?.anonymousId?.()
    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}

/**
 * Sends an Onboarding Checkpoint event to Segment. The user_id is the
 * Segment anonymousId by default — landing and auth share the same domain
 * (`decentraland.org`) so the cookie carries the same id end-to-end.
 *
 * Callers can override `userIdentifier`/`identifierType` after auth completes
 * (when wallet/email become known), but the anonymousId stays the canonical
 * link with CP1 (landing) and CP3 (Explorer via campaign_anon_user_id).
 *
 * Safe to call before analytics.js finishes loading — falls through silently.
 */
function trackCheckpoint(params: CheckpointParams): void {
  const analytics = getAnalytics()
  if (!analytics) return

  const anonymousId = safeAnonymousId()
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

/**
 * Schedules a checkpoint to fire as soon as analytics.js is ready. If the
 * library is already loaded, runs synchronously. Otherwise the snippet's
 * stub `analytics.ready` queues the callback until the real library
 * finishes loading.
 *
 * Use this for fire-on-mount checkpoints (e.g. CP2 reached on LoginPage)
 * where the component may render before the analytics library is ready.
 */
function trackCheckpointWhenReady(params: CheckpointParams): void {
  const analytics = getAnalytics()
  if (!analytics) return

  const fire = () => trackCheckpoint(params)

  if (typeof analytics.ready === 'function') {
    try {
      analytics.ready(fire)
      return
    } catch {
      // fall through
    }
  }
  fire()
}

export { trackCheckpoint, trackCheckpointWhenReady }
