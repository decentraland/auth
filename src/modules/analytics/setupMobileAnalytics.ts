/* eslint-disable @typescript-eslint/naming-convention */
import type { MobileSession } from '../../shared/mobile'

// Loose shape of the payload Segment passes to source-middlewares. The official
// @types/segment-analytics package doesn't model this, so we narrow it locally.
interface SegmentSourceMiddlewarePayload {
  obj: {
    type?: string
    properties?: Record<string, unknown>
    traits?: Record<string, unknown>
  }
}

type SegmentSourceMiddleware = (input: {
  payload: SegmentSourceMiddlewarePayload
  next: (payload: SegmentSourceMiddlewarePayload) => void
}) => void

// addSourceMiddleware exists on the runtime Segment instance (see modules/analytics/snippet.ts)
// but is missing from the @types/segment-analytics definitions, so we narrow to what we need.
interface AnalyticsTarget {
  addSourceMiddleware: (mw: SegmentSourceMiddleware) => void
  identify: SegmentAnalytics.AnalyticsJS['identify']
}

/**
 * Attaches mobile-session context (mobile_user_id / mobile_session_id) to every
 * Segment event for the lifetime of the page, and identifies the mobile user if
 * we know who they are. No-op when there is no mobile session.
 */
function setupMobileAnalytics(analytics: SegmentAnalytics.AnalyticsJS | undefined, mobileSession: MobileSession | null): void {
  if (!analytics || !mobileSession || (!mobileSession.u && !mobileSession.s)) {
    return
  }

  const target = analytics as unknown as AnalyticsTarget

  const mobileContext: Record<string, string> = {
    ...(mobileSession.u && { mobile_user_id: mobileSession.u }),
    ...(mobileSession.s && { mobile_session_id: mobileSession.s })
  }

  target.addSourceMiddleware(({ payload, next }) => {
    const { obj } = payload
    if (obj.type === 'identify' || obj.type === 'group') {
      obj.traits = { ...(obj.traits || {}), ...mobileContext }
    } else {
      obj.properties = { ...(obj.properties || {}), ...mobileContext }
    }
    next(payload)
  })

  if (mobileSession.u) {
    target.identify(mobileSession.u, mobileContext)
  }
}

export { setupMobileAnalytics }
