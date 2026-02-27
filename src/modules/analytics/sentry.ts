import { browserTracingIntegration, init, replayIntegration, setTag, setUser } from '@sentry/react'
import { Env } from '@dcl/ui-env/dist/env'
import { getMobileSession, isMobileSession } from '../../shared/mobile'
import { config } from '../config'

const mobile = isMobileSession()
const dsn = mobile ? config.get('SENTRY_DSN_MOBILE') : config.get('SENTRY_DSN')

init({
  environment: config.get('ENVIRONMENT'),
  release: `${config.get('SENTRY_RELEASE_PREFIX', 'auth')}@${import.meta.env.VITE_REACT_APP_WEBSITE_VERSION}`,
  dsn,
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

// Set mobile-specific tags after init
if (mobile) {
  const session = getMobileSession()
  if (session?.u) setUser({ id: session.u })
  if (session?.s) setTag('dcl_session_id', session.s)
}
