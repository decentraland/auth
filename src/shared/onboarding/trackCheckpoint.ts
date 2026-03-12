import { getAnalytics } from '../../modules/analytics/segment'

type CheckpointParams = {
  checkpointId: number
  action?: 'reached' | 'completed'
  userIdentifier?: string
  identifierType?: 'email' | 'wallet'
  email?: string
  wallet?: string
  source?: 'auth'
  metadata?: Record<string, unknown>
}

export function trackCheckpoint(params: CheckpointParams): void {
  getAnalytics()?.track('Onboarding Checkpoint', {
    checkpointId: params.checkpointId,
    action: params.action ?? 'reached',
    userIdentifier: params.userIdentifier,
    identifierType: params.identifierType,
    email: params.email,
    wallet: params.wallet,
    source: params.source ?? 'auth',
    metadata: params.metadata
  })
}
