import { init, browserTracingIntegration, replayIntegration } from '@sentry/react'
import { Env } from '@dcl/ui-env/dist/env'
import { isMobile } from '../../components/Pages/LoginPage/utils'
import { config } from '../config'

const isMobileDevice = isMobile()
const isSentryEnabled = !config.is(Env.DEVELOPMENT) && !isMobileDevice

init({
  environment: config.get('ENVIRONMENT'),
  release: `${config.get('SENTRY_RELEASE_PREFIX', 'auth')}@${process.env.VITE_REACT_APP_WEBSITE_VERSION}`,
  dsn: config.get('SENTRY_DSN'),
  integrations: [browserTracingIntegration(), replayIntegration()],
  // Performance Monitoring
  tracesSampleRate: isSentryEnabled ? 0.001 : 0,
  // Session Replay
  replaysSessionSampleRate: isSentryEnabled ? 0.01 : 0,
  replaysOnErrorSampleRate: isSentryEnabled ? 0.01 : 0,
  enabled: isSentryEnabled,
  beforeSend(event) {
    // Filter out events from mobile devices
    if (isMobileDevice) {
      return null
    }
    // Filter out exceptions from GTM and STAG
    if (
      event.exception?.values?.some(exception =>
        exception.stacktrace?.frames?.some(frame => frame.filename?.includes('gtm') || frame.filename?.includes('stag'))
      )
    ) {
      return null
    }
    return event
  },
  beforeSendTransaction(event) {
    if (isMobileDevice) {
      return null
    }
    return event
  }
})
