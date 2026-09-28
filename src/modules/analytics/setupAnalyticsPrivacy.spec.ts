import { setupAnalyticsPrivacy } from './setupAnalyticsPrivacy'

describe('when configuring analytics privacy', () => {
  let addSourceMiddleware: jest.Mock
  let analytics: SegmentAnalytics.AnalyticsJS
  let payload: { obj: Record<string, unknown> }
  let next: jest.Mock

  beforeEach(() => {
    addSourceMiddleware = jest.fn()
    analytics = { addSourceMiddleware } as unknown as SegmentAnalytics.AnalyticsJS
    next = jest.fn()
    payload = {
      obj: {
        type: 'page',
        properties: {
          url: 'https://auth.example/auth/callback?code=private-code&state=private-state#private-fragment',
          search: '?code=private-code&state=private-state',
          referrer: 'https://login.example/authorize?state=private-state',
          title: 'Authentication'
        },
        context: { page: { url: 'https://auth.example/auth/callback?code=private-code', search: '?code=private-code' } }
      }
    }
    setupAnalyticsPrivacy(analytics)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should forward useful event context without callback query or fragment data', () => {
    addSourceMiddleware.mock.calls[0][0]({ payload, next })
    expect(JSON.stringify(payload)).not.toContain('private-')
    expect(payload.obj).toEqual(
      expect.objectContaining({
        type: 'page',
        properties: expect.objectContaining({ url: 'https://auth.example/auth/callback', title: 'Authentication' })
      })
    )
    expect(next).toHaveBeenCalledWith(payload)
  })

  describe('and analytics is unavailable', () => {
    beforeEach(() => {
      addSourceMiddleware.mockClear()
    })

    it('should skip registration', () => {
      setupAnalyticsPrivacy(undefined)
      expect(addSourceMiddleware).not.toHaveBeenCalled()
    })
  })
})
