/* eslint-disable @typescript-eslint/naming-convention */
import { setupMobileAnalytics } from './setupMobileAnalytics'

interface MiddlewarePayload {
  obj: { type?: string; properties?: Record<string, unknown>; traits?: Record<string, unknown> }
}
type Middleware = (input: { payload: MiddlewarePayload; next: (payload: MiddlewarePayload) => void }) => void

function createAnalyticsStub() {
  const addSourceMiddleware = jest.fn()
  const identify = jest.fn()
  // setupMobileAnalytics casts the input to a richer shape internally; the cast through `unknown`
  // is enough for jest mocks here.
  return { addSourceMiddleware, identify } as unknown as SegmentAnalytics.AnalyticsJS & {
    addSourceMiddleware: jest.Mock
    identify: jest.Mock
  }
}

describe('setupMobileAnalytics', () => {
  describe('when analytics is undefined', () => {
    it('should not throw', () => {
      expect(() => setupMobileAnalytics(undefined, { u: 'u1', s: 's1' })).not.toThrow()
    })
  })

  describe('when there is no mobile session', () => {
    let analytics: ReturnType<typeof createAnalyticsStub>

    beforeEach(() => {
      analytics = createAnalyticsStub()
      setupMobileAnalytics(analytics, null)
    })

    it('should not register a middleware', () => {
      expect(analytics.addSourceMiddleware).not.toHaveBeenCalled()
    })

    it('should not call identify', () => {
      expect(analytics.identify).not.toHaveBeenCalled()
    })
  })

  describe('when the mobile session has neither u nor s', () => {
    let analytics: ReturnType<typeof createAnalyticsStub>

    beforeEach(() => {
      analytics = createAnalyticsStub()
      setupMobileAnalytics(analytics, {})
    })

    it('should not register a middleware', () => {
      expect(analytics.addSourceMiddleware).not.toHaveBeenCalled()
    })

    it('should not call identify', () => {
      expect(analytics.identify).not.toHaveBeenCalled()
    })
  })

  describe('when only the mobile session id is present', () => {
    let analytics: ReturnType<typeof createAnalyticsStub>

    beforeEach(() => {
      analytics = createAnalyticsStub()
      setupMobileAnalytics(analytics, { s: 'sess-1' })
    })

    it('should register a source middleware that attaches mobile_session_id', () => {
      const middleware = analytics.addSourceMiddleware.mock.calls[0][0] as Middleware
      const next = jest.fn()
      const payload = { obj: { type: 'track', properties: { foo: 'bar' } } }

      middleware({ payload, next })

      expect(payload.obj.properties).toEqual({ foo: 'bar', mobile_session_id: 'sess-1' })
      expect(next).toHaveBeenCalledWith(payload)
    })

    it('should not call identify when there is no user id', () => {
      expect(analytics.identify).not.toHaveBeenCalled()
    })
  })

  describe('when both u and s are present', () => {
    let analytics: ReturnType<typeof createAnalyticsStub>

    beforeEach(() => {
      analytics = createAnalyticsStub()
      setupMobileAnalytics(analytics, { u: 'user-1', s: 'sess-1' })
    })

    it('should call identify with the mobile user id and both context fields as traits', () => {
      expect(analytics.identify).toHaveBeenCalledWith('user-1', {
        mobile_user_id: 'user-1',
        mobile_session_id: 'sess-1'
      })
    })

    it('should attach mobile context to track events under properties', () => {
      const middleware = analytics.addSourceMiddleware.mock.calls[0][0] as Middleware
      const payload = { obj: { type: 'track', properties: { event: 'click' } } }

      middleware({ payload, next: jest.fn() })

      expect(payload.obj.properties).toEqual({
        event: 'click',
        mobile_user_id: 'user-1',
        mobile_session_id: 'sess-1'
      })
    })

    it('should attach mobile context to identify/group events under traits, not properties', () => {
      const middleware = analytics.addSourceMiddleware.mock.calls[0][0] as Middleware

      const identifyPayload = { obj: { type: 'identify', traits: { foo: 'bar' } } }
      middleware({ payload: identifyPayload, next: jest.fn() })
      expect(identifyPayload.obj.traits).toEqual({
        foo: 'bar',
        mobile_user_id: 'user-1',
        mobile_session_id: 'sess-1'
      })

      const groupPayload = { obj: { type: 'group', traits: {} } }
      middleware({ payload: groupPayload, next: jest.fn() })
      expect(groupPayload.obj.traits).toEqual({
        mobile_user_id: 'user-1',
        mobile_session_id: 'sess-1'
      })
    })
  })
})
