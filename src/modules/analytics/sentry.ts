import { init, browserTracingIntegration, replayIntegration, setTag } from '@sentry/react'
import { Env } from '@dcl/ui-env/dist/env'
import { isMobileAuthFlow } from '../../components/Pages/MobileAuthPage/utils'
import { config } from '../config'

const mobile = isMobileAuthFlow()

init({
  environment: config.get('ENVIRONMENT'),
  release: `${config.get('SENTRY_RELEASE_PREFIX', 'auth')}@${process.env.VITE_REACT_APP_WEBSITE_VERSION}`,
  dsn: mobile ? config.get('SENTRY_MOBILE_DSN') : config.get('SENTRY_DSN'),
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

if (mobile) {
  setTag('isMobileFlow', true)
}
