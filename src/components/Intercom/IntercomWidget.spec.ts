import { IntercomWidget } from './IntercomWidget'
import { IntercomWindow } from './Intercom.types'

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
})
