/* eslint-disable @typescript-eslint/naming-convention */
import { setupMobileAnalytics } from './setupMobileAnalytics'

type SnippetAnalytics = unknown[] & {
  load: (key: string, options?: unknown) => void
  _cdn?: string
  _analyticsUrl?: string
  _loadOptions?: unknown
}
type QueuedSourceMiddleware = (input: {
  payload: { obj: { type?: string; properties?: Record<string, unknown> } }
  next: (payload: unknown) => void
}) => void

const getSnippetAnalytics = () => (window as unknown as { analytics: SnippetAnalytics }).analytics

const loadedScriptSrc = () => document.head.querySelectorAll('script')[0].getAttribute('src')

describe('when loading analytics.js through the snippet', () => {
  beforeEach(async () => {
    delete (window as unknown as { analytics?: unknown }).analytics
    document.head.replaceChildren(document.createElement('script'))
    await jest.isolateModulesAsync(async () => {
      // @ts-expect-error snippet.ts is a self-executing script, it has no exports for TypeScript to resolve
      await import('./snippet')
    })
  })

  describe('and no first party cdn was configured', () => {
    beforeEach(() => {
      getSnippetAnalytics().load('aWriteKey')
    })

    it('should load the bundle from segment cdn', () => {
      expect(loadedScriptSrc()).toBe('https://cdn.segment.com/analytics.js/v1/aWriteKey/analytics.min.js')
    })
  })

  describe('and a first party cdn was configured', () => {
    beforeEach(() => {
      getSnippetAnalytics()._cdn = 'https://evs.example.org'
      getSnippetAnalytics().load('aWriteKey')
    })

    it('should load the bundle from it', () => {
      expect(loadedScriptSrc()).toBe('https://evs.example.org/analytics.js/v1/aWriteKey/analytics.min.js')
    })
  })

  describe('and a first party bundle url was configured', () => {
    beforeEach(() => {
      getSnippetAnalytics()._cdn = 'https://evs.example.org'
      getSnippetAnalytics()._analyticsUrl = 'https://evs.example.org/aPath/aBundle.min.js'
      getSnippetAnalytics().load('aWriteKey')
    })

    it('should load the bundle from it instead of the cdn path', () => {
      expect(loadedScriptSrc()).toBe('https://evs.example.org/aPath/aBundle.min.js')
    })
  })

  describe('and the mobile session middleware is set up while the bundle loads from a first party bundle url', () => {
    let middlewares: QueuedSourceMiddleware[]

    beforeEach(() => {
      const analytics = getSnippetAnalytics()
      analytics._analyticsUrl = 'https://evs.example.org/aPath/aBundle.min.js'
      analytics.load('aWriteKey')
      setupMobileAnalytics(analytics as unknown as SegmentAnalytics.AnalyticsJS, { u: 'user-1', s: 'sess-1' })
      middlewares = analytics
        .filter((call): call is ['addSourceMiddleware', QueuedSourceMiddleware] => (call as unknown[])[0] === 'addSourceMiddleware')
        .map(([, middleware]) => middleware)
    })

    it('should queue the source middleware for analytics.js to replay once it boots', () => {
      expect(middlewares).toHaveLength(1)
    })

    it('should attach the mobile context to the events through the queued middleware', () => {
      const payload = { obj: { type: 'track', properties: { foo: 'bar' } } }
      const next = jest.fn()

      middlewares[0]({ payload, next })

      expect(payload.obj.properties).toEqual({ foo: 'bar', mobile_user_id: 'user-1', mobile_session_id: 'sess-1' })
      expect(next).toHaveBeenCalledWith(payload)
    })
  })

  describe('and load options are given', () => {
    const options = { integrations: { 'Segment.io': { apiHost: 'api.example.org/v1' } } }

    beforeEach(() => {
      getSnippetAnalytics().load('aWriteKey', options)
    })

    it('should keep them for analytics.js to read once it boots', () => {
      expect(getSnippetAnalytics()._loadOptions).toBe(options)
    })
  })
})
