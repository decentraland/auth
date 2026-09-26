import { captureException } from '@sentry/react'
import { handleError } from '../../shared/utils/errorHandler'
import { IntercomWidget } from './IntercomWidget'
import { IntercomWindow } from './Intercom.types'

jest.mock('@sentry/react', () => ({
  captureException: jest.fn()
}))

jest.mock('../../shared/utils/analytics', () => ({
  trackEvent: jest.fn()
}))

const mockCaptureException = captureException as jest.Mock

const APP_ID = 'test-app-id'
const WIDGET_SRC = `https://widget.intercom.io/widget/${APP_ID}`

const getInjectedScript = () => document.body.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`)

describe('IntercomWidget#inject', () => {
  beforeEach(() => {
    // Ensure isInjected() is false so inject() actually appends a script.
    delete (window as unknown as IntercomWindow).Intercom
    document.body.innerHTML = ''
  })

  describe('when the widget script fails to load', () => {
    it('should reject with an error flagged skipReporting so it stays out of Sentry', async () => {
      const widget = new IntercomWidget()
      widget.init(APP_ID)

      const injection = widget.inject()
      const script = getInjectedScript()
      expect(script).not.toBeNull()

      script!.dispatchEvent(new Event('error'))

      await expect(injection).rejects.toMatchObject({
        message: 'Failed to load the Intercom widget script',
        skipReporting: true
      })
    })
  })

  describe('when the widget script never settles within the timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should reject with an error flagged skipReporting so it stays out of Sentry', async () => {
      const widget = new IntercomWidget()
      widget.init(APP_ID)

      const injection = widget.inject()
      // Attach the expectation before advancing timers so the rejection is always handled.
      const assertion = expect(injection).rejects.toMatchObject({
        message: 'Timed out loading the Intercom widget script',
        skipReporting: true
      })

      jest.advanceTimersByTime(10000)

      await assertion
    })
  })

  // The suppression only holds if the error inject() produces is the shape handleError skips.
  // These lock that end-to-end contract so a future refactor of either side can't silently
  // start reporting (or over-broaden the suppression to genuine failures).
  describe('when the rejected error reaches handleError (as the caller does)', () => {
    let consoleErrorSpy: jest.SpyInstance

    beforeEach(() => {
      mockCaptureException.mockClear()
      // handleError logs non-skipped errors to console.error; keep test output clean.
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('should not be reported to Sentry', async () => {
      const widget = new IntercomWidget()
      widget.init(APP_ID)

      const injection = widget.inject()
      getInjectedScript()!.dispatchEvent(new Event('error'))

      try {
        await injection
      } catch (error) {
        handleError(error, 'Could not render intercom', { skipTracking: true })
      }

      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('should still report an ordinary error, so suppression is not over-broad', () => {
      handleError(new Error('some genuine failure'), 'Could not render intercom', { skipTracking: true })

      expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })
  })
})
