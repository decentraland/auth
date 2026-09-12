import { sanitizeTelemetryData } from './privacy'

type MiddlewarePayload = { obj: Record<string, unknown> }
type SourceMiddleware = (input: { payload: MiddlewarePayload; next: (payload: MiddlewarePayload) => void }) => void

/** Remove URL query and fragment data before Segment forwards events to destinations. */
export function setupAnalyticsPrivacy(analytics: SegmentAnalytics.AnalyticsJS | undefined): void {
  if (!analytics) return
  const target = analytics as unknown as { addSourceMiddleware: (middleware: SourceMiddleware) => void }
  target.addSourceMiddleware(({ payload, next }) => {
    Object.assign(payload.obj, sanitizeTelemetryData(payload.obj))
    next(payload)
  })
}
