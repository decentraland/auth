import { browserTracingIntegration, init, replayIntegration, setTag, setUser } from '@sentry/react'
import { Env } from '@dcl/ui-env/dist/env'
import { getMobileSession, isMobileSession } from '../../shared/mobile'
import { config } from '../config'
import { beforeSend } from './sentryFilters'

const mobile = isMobileSession()
const dsn = mobile ? config.get('SENTRY_DSN_MOBILE') : config.get('SENTRY_DSN')

init({
  environment: config.get('ENVIRONMENT'),
  release: `${config.get('SENTRY_RELEASE_PREFIX', 'auth')}@${import.meta.env.VITE_REACT_APP_WEBSITE_VERSION}`,
  dsn,
  // Explicitly mask all text and media in Session Replay. This surface renders email/OTP
  // inputs and sign-in verification codes, so we never want replays to capture their values.
  integrations: [browserTracingIntegration(), replayIntegration({ maskAllText: true, blockAllMedia: true })],
  // Performance Monitoring
  tracesSampleRate: 0.001,
  // Session Replay
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.01,
  enabled: !config.is(Env.DEVELOPMENT),
  beforeSend
})

// Set mobile-specific tags after init
if (mobile) {
  const session = getMobileSession()
  if (session?.u) setUser({ id: session.u })
  if (session?.s) setTag('dcl_session_id', session.s)
}
