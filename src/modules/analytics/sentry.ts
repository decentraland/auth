import { init, browserTracingIntegration, replayIntegration } from '@sentry/react'
import { Env } from '@dcl/ui-env/dist/env'
import { isIgnorableErrorMessage } from '../../shared/utils/ignorableErrors'
import { config } from '../config'

init({
  environment: config.get('ENVIRONMENT'),
  release: `${config.get('SENTRY_RELEASE_PREFIX', 'auth')}@${process.env.VITE_REACT_APP_WEBSITE_VERSION}`,
  dsn: config.get('SENTRY_DSN'),
  integrations: [browserTracingIntegration(), replayIntegration()],
  // Performance Monitoring
  tracesSampleRate: 0.001,
  // Session Replay
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.01,
  enabled: !config.is(Env.DEVELOPMENT),
  beforeSend(event) {
    // Filter out exceptions from GTM and STAG
    if (
      event.exception?.values?.some(exception =>
        exception.stacktrace?.frames?.some(frame => frame.filename?.includes('gtm') || frame.filename?.includes('stag'))
      )
    ) {
      return null
    }

    // Filter out ignorable errors - check multiple locations
    if (
      event.exception?.values?.some(exception => {
        // Check exception.value (most common)
        if (exception.value && isIgnorableErrorMessage(exception.value)) {
          return true
        }
        // Check exception.type (some errors use type as message)
        if (exception.type && isIgnorableErrorMessage(exception.type)) {
          return true
        }
        return false
      })
    ) {
      return null
    }

    // Also check event.message for non-exception captures
    if (event.message && isIgnorableErrorMessage(event.message)) {
      return null
    }

    return event
  }
})
