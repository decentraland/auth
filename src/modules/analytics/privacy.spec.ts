/* eslint-disable @typescript-eslint/naming-convention -- Sentry request fields use their wire-format names. */
import { BrowserClient, defaultStackParser, httpContextIntegration } from '@sentry/browser'
import type { Envelope, Event } from '@sentry/core'
import { isOauthCallbackPath, sanitizeTelemetryData, sanitizeTelemetryUrl } from './privacy'

describe('when sanitizing telemetry URLs', () => {
  describe('and a URL carries a query and fragment', () => {
    let url: string

    beforeEach(() => {
      url = 'https://example.invalid/auth/callback?code=synthetic-code#state=synthetic-state'
    })

    it('should retain the origin and route only', () => {
      expect(sanitizeTelemetryUrl(url)).toBe('https://example.invalid/auth/callback')
    })
  })

  describe('and telemetry contains nested request, span, breadcrumb and replay data', () => {
    let data: Record<string, unknown>

    beforeEach(() => {
      data = {
        request: { url: 'https://example.invalid/auth/callback?code=synthetic', query_string: 'code=synthetic' },
        breadcrumbs: [{ category: 'navigation', data: { from: '/auth/login?state=synthetic', to: '/auth/callback#synthetic' } }],
        spans: [
          {
            description: 'GET https://example.invalid/auth/callback?code=synthetic',
            status: 'ok',
            data: { 'http.query': '?code=synthetic', 'http.fragment': '#state=synthetic' }
          }
        ],
        urls: ['https://example.invalid/auth/callback?state=synthetic'],
        context: { page: { url: 'https://example.invalid/auth/callback?code=synthetic', search: '?code=synthetic' } },
        message: 'Authentication failed',
        level: 'error'
      }
    })

    it('should remove sensitive URL content while preserving route and diagnostic information', () => {
      expect(sanitizeTelemetryData(data)).toEqual({
        request: { url: 'https://example.invalid/auth/callback', query_string: '[Filtered]' },
        breadcrumbs: [{ category: 'navigation', data: { from: '/auth/login', to: '/auth/callback' } }],
        spans: [
          {
            description: 'GET https://example.invalid/auth/callback',
            status: 'ok',
            data: { 'http.query': '[Filtered]', 'http.fragment': '[Filtered]' }
          }
        ],
        urls: ['https://example.invalid/auth/callback'],
        context: { page: { url: 'https://example.invalid/auth/callback', search: '[Filtered]' } },
        message: 'Authentication failed',
        level: 'error'
      })
    })

    it('should preserve the original application data', () => {
      sanitizeTelemetryData(data)
      expect(data.request).toEqual({ url: 'https://example.invalid/auth/callback?code=synthetic', query_string: 'code=synthetic' })
    })
  })
})

describe('when Sentry sends an event from an OAuth callback', () => {
  let originalUrl: string
  let callbackUrl: string
  let client: BrowserClient
  let envelopes: Envelope[]

  beforeEach(() => {
    originalUrl = window.location.href
    callbackUrl = `${window.location.origin}/auth/callback?code=synthetic#state=synthetic`
    window.history.replaceState({}, '', callbackUrl)
    envelopes = []
    client = new BrowserClient({
      dsn: 'https://public@example.invalid/1',
      stackParser: defaultStackParser,
      integrations: [httpContextIntegration(), { name: 'AuthUrlPrivacy', processEvent: sanitizeTelemetryData }],
      transport: () => ({
        send: async envelope => {
          envelopes.push(envelope)
          return { statusCode: 200 }
        },
        flush: async () => true
      })
    })
    client.init()
  })

  afterEach(async () => {
    await client.close()
    window.history.replaceState({}, '', originalUrl)
  })

  it('should scrub the SDK-added URL before it reaches the transport', async () => {
    client.captureMessage('Synthetic callback failure')
    await client.flush()
    expect((envelopes[0][1][0][1] as Event).request?.url).toBe(`${window.location.origin}/auth/callback`)
  })
})

describe('when selecting documents eligible for replay', () => {
  describe.each(['/auth/callback', '/auth/callback/', '/auth/mobile/callback', '/auth/mobile/callback/', '/auth/call%62ack'])(
    'and the route is %s',
    path => {
      it('should identify the callback document for exclusion', () => {
        expect(isOauthCallbackPath(path)).toBe(true)
      })
    }
  )

  describe('and the route is the login page', () => {
    it('should retain replay eligibility', () => {
      expect(isOauthCallbackPath('/auth/login')).toBe(false)
    })
  })
})
