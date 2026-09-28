/* eslint-disable @typescript-eslint/naming-convention */
import type { ErrorEvent } from '@sentry/react'
import { beforeSend } from './sentryFilters'

/** Helper — builds a minimal ErrorEvent with one exception entry. */
function buildEvent(overrides: {
  type?: string
  value?: string
  frames?: Array<{ filename?: string; module?: string; in_app?: boolean }>
}): ErrorEvent {
  return {
    exception: {
      values: [
        {
          type: overrides.type ?? 'Error',
          value: overrides.value ?? '',
          stacktrace: overrides.frames ? { frames: overrides.frames } : undefined
        }
      ]
    }
  } as unknown as ErrorEvent
}

describe('beforeSend', () => {
  describe('WalletConnect stale-session-topic filter', () => {
    it('should drop the error when the value mentions a missing session topic and a frame is from walletconnect', () => {
      const event = buildEvent({
        value: "No matching key. session topic doesn't exist: abc123def",
        frames: [{ module: '@dcl/auth-site/node_modules/@walletconnect/sign-client/dist/index', in_app: false }]
      })

      expect(beforeSend(event)).toBeNull()
    })

    it('should keep the error when the message matches but no walletconnect frame is present', () => {
      const event = buildEvent({
        value: "No matching key. session topic doesn't exist: abc123def",
        frames: [{ module: 'src/components/Login', in_app: true }]
      })

      expect(beforeSend(event)).toBe(event)
    })

    it('should keep the error when a walletconnect frame is present but the message is different', () => {
      const event = buildEvent({
        value: 'Some other WalletConnect error',
        frames: [{ module: '@dcl/auth-site/node_modules/@walletconnect/sign-client/dist/index', in_app: false }]
      })

      expect(beforeSend(event)).toBe(event)
    })
  })

  describe('existing filters remain intact', () => {
    it('should drop GTM errors', () => {
      const event = buildEvent({
        value: 'Script error.',
        frames: [{ filename: 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXXX' }]
      })

      expect(beforeSend(event)).toBeNull()
    })

    it('should drop clipboard DOMException when the document is not focused', () => {
      const event = buildEvent({
        type: 'DOMException',
        value: 'Document is not focused.'
      })

      expect(beforeSend(event)).toBeNull()
    })

    it('should drop idle timeout errors from third-party scripts', () => {
      const event = buildEvent({
        value: 'JS idle timeout exceeded',
        frames: [{ filename: 'https://cdn.example.com/vendor.js', in_app: false }]
      })

      expect(beforeSend(event)).toBeNull()
    })

    it('should pass through unrelated errors', () => {
      const event = buildEvent({
        value: 'TypeError: Cannot read properties of undefined',
        frames: [{ filename: 'src/components/LoginPage.tsx', in_app: true }]
      })

      expect(beforeSend(event)).toBe(event)
    })
  })
})
