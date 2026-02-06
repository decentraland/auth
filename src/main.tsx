/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import './polyfills.ts'
import 'semantic-ui-css/semantic.min.css'
import * as React from 'react'
import { useEffect } from 'react'
import * as ReactDOM from 'react-dom'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { darkTheme, DclThemeProvider } from 'decentraland-ui2'
import { Env } from '@dcl/ui-env'
import { RequestPage } from './components/Pages/RequestPage'
import { SetupPage } from './components/Pages/SetupPage'
import { DefaultPage } from './components/Pages/DefaultPage'
import { AvatarSetupPage } from './components/Pages/AvatarSetupPage/AvatarSetupPage'
import Intercom from './components/Intercom'
import { CallbackPage } from './components/Pages/CallbackPage'
import { InvalidRedirectionPage } from './components/Pages/InvalidRedirectionPage'
import { LoginPage } from './components/Pages/LoginPage'
import { MobileAuthPage } from './components/Pages/MobileAuthPage'
import { MobileCallbackPage } from './components/Pages/MobileCallbackPage'
import { FeatureFlagsProvider } from './components/FeatureFlagsProvider'
import { config } from './modules/config'
import { getAnalytics } from './modules/analytics/segment'
import './modules/analytics/snippet'
import './modules/analytics/sentry'
import { getMobileSession } from './shared/mobile'
import 'decentraland-ui/dist/themes/alternative/dark-theme.css'
import './index.css'

const analytics = getAnalytics()
analytics?.load(config.get('SEGMENT_API_KEY'))

const mobileSession = getMobileSession()
if (mobileSession?.u) {
  analytics?.identify(mobileSession.u)
}

const DevTestViewPage = !config.is(Env.PRODUCTION)
  ? React.lazy(async () => {
      const mod = await import('./components/Pages/RequestPage/TestViewPage')
      return { default: mod.TestViewPage }
    })
  : undefined

const SiteRoutes = () => {
  const location = useLocation()
  const analytics = getAnalytics()

  useEffect(() => {
    analytics?.page()
  }, [location, analytics])

  return (
    <Routes>
      <Route path="/login" Component={LoginPage} />
      <Route path="/invalidRedirection" Component={InvalidRedirectionPage} />
      <Route path="/callback" Component={CallbackPage} />
      <Route path="/requests/:requestId" Component={RequestPage} />
      {DevTestViewPage ? (
        <Route
          path="/testView/:viewId"
          element={
            <React.Suspense fallback={null}>
              <DevTestViewPage />
            </React.Suspense>
          }
        />
      ) : null}
      <Route path="/setup" Component={SetupPage} />
      <Route path="/avatar-setup" Component={AvatarSetupPage} />
      <Route path="/mobile" Component={MobileAuthPage} />
      <Route path="/mobile/callback" Component={MobileCallbackPage} />
      <Route path="*" Component={DefaultPage} />
    </Routes>
  )
}

ReactDOM.render(
  <React.StrictMode>
    <FeatureFlagsProvider>
      <DclThemeProvider theme={darkTheme}>
        <BrowserRouter basename="/auth">
          <SiteRoutes />
        </BrowserRouter>
      </DclThemeProvider>
      <Intercom appId={config.get('INTERCOM_APP_ID')} settings={{ alignment: 'right' }} />
    </FeatureFlagsProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
