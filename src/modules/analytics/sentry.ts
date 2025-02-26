import { init, browserTracingIntegration, replayIntegration } from '@sentry/react'
import { Env } from '@dcl/ui-env/dist/env'
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
    return event
  }
})
