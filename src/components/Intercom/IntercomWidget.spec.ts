import { IntercomWidget } from './IntercomWidget'

const INJECT_TIMEOUT_MS = 10000

type UnreportableError = Error & { skipReporting?: boolean }

/**
 * Awaits a promise expected to reject and hands back the rejection. Fails loudly if it resolves,
 * so a regression that silently stops rejecting cannot pass as an absent `skipReporting`.
 */
async function rejectionOf(promise: Promise<unknown>): Promise<UnreportableError> {
  try {
    await promise
  } catch (thrown) {
    return thrown as UnreportableError
  }

  throw new Error('Expected the injection to reject, but it resolved')
}

describe('IntercomWidget.inject', () => {
  let widget: IntercomWidget

  beforeEach(() => {
    document.body.innerHTML = ''
    widget = IntercomWidget.getInstance()
    widget.init('an-app-id')
  })

  const insertedScript = () => document.body.querySelector('script') as HTMLScriptElement

  describe('when the widget script is blocked before it can load', () => {
    let error: UnreportableError

    beforeEach(async () => {
      const injecting = widget.inject()
      insertedScript().dispatchEvent(new Event('error'))
      error = await rejectionOf(injecting)
    })

    it('should reject explaining the script could not be loaded', () => {
      expect(error.message).toBe('Failed to load the Intercom widget script')
    })

    // The widget is blocked by ad/tracking blockers, privacy browsers and ISP filtering. Nothing
    // is broken on our side and the site works without it, so the rejection must not be reported.
    it('should flag the rejection so it stays out of Sentry', () => {
      expect(error.skipReporting).toBe(true)
    })
  })

  describe('when the widget script never loads', () => {
    let error: UnreportableError

    beforeEach(async () => {
      jest.useFakeTimers()
      const injecting = widget.inject()
      jest.advanceTimersByTime(INJECT_TIMEOUT_MS)
      error = await rejectionOf(injecting)
      jest.useRealTimers()
    })

    it('should reject explaining the load timed out', () => {
      expect(error.message).toBe('Timed out loading the Intercom widget script')
    })

    it('should flag the rejection so it stays out of Sentry', () => {
      expect(error.skipReporting).toBe(true)
    })
  })

  describe('when a blocked injection is retried', () => {
    it('should attempt a fresh injection rather than replaying the cached failure', async () => {
      const firstAttempt = widget.inject()
      insertedScript().dispatchEvent(new Event('error'))
      await firstAttempt.catch(() => undefined)

      document.body.innerHTML = ''
      const secondAttempt = widget.inject()

      expect(insertedScript()).not.toBeNull()

      insertedScript().dispatchEvent(new Event('error'))
      await secondAttempt.catch(() => undefined)
    })
  })
})
