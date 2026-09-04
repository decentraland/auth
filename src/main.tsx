/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import './polyfills.ts'
import * as React from 'react'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { TranslationProvider } from '@dcl/hooks'
import { RequestPageRoute } from './components/Pages/RequestPage'
import { SetupPage } from './components/Pages/SetupPage'
import { DefaultPage } from './components/Pages/DefaultPage'
import { AvatarSetupPage } from './components/Pages/AvatarSetupPage/AvatarSetupPage'
import { QuickSetupPage } from './components/Pages/QuickSetupPage/QuickSetupPage'
import Intercom from './components/Intercom'
import { CallbackPage } from './components/Pages/CallbackPage'
import { InvalidRedirectionPage } from './components/Pages/InvalidRedirectionPage'
import { LoginRouteGuard } from './components/Pages/LoginPage'
import { MobileAuthPage } from './components/Pages/MobileAuthPage'
import { MobileCallbackPage } from './components/Pages/MobileCallbackPage'
import { FeatureFlagsProvider } from './components/FeatureFlagsProvider'
import { ConnectionProvider } from './shared/connection'
import { config } from './modules/config'
import { translations } from './modules/translations'
import { getAnalytics } from './modules/analytics/segment'
import { setupMobileAnalytics } from './modules/analytics/setupMobileAnalytics'
import './modules/analytics/snippet'
import './modules/analytics/sentry'
import { getMobileSession } from './shared/mobile'
import './index.css'

const supportedLocales = Object.keys(translations)
const getInitialLocale = (): string => {
  const urlParams = new URLSearchParams(window.location.search)
  const urlLocale = urlParams.get('lang')
  if (urlLocale && supportedLocales.includes(urlLocale)) return urlLocale

  const storedLocale = localStorage.getItem('dcl_locale')
  if (storedLocale && supportedLocales.includes(storedLocale)) return storedLocale

  const browserLocale = navigator.language.split('-')[0]
  if (supportedLocales.includes(browserLocale)) return browserLocale

  return 'en'
}

const initialLocale = getInitialLocale()

const analytics = getAnalytics()
analytics?.load(config.get('SEGMENT_API_KEY'))

setupMobileAnalytics(analytics, getMobileSession())

// Gate the dev-only TestViewPage on the serving HOSTNAME, not on the runtime config env. The
// config environment (@dcl/ui-env) honors a `?env=` query param, so a config check is bypassable —
// e.g. `decentraland.org/auth/testView/...?env=dev` would open the gate and render a realistic but
// fake approval dialog on the production origin. A query param cannot change the hostname, so this
// blocks every production Decentraland origin (`decentraland.org` and its subdomains) while still
// exposing the harness where it's legitimately used: the local dev server and E2E preview (both on
// localhost) and the non-production `.zone`/`.today` deploys.
const isProductionHost = /(^|\.)decentraland\.org$/i.test(window.location.hostname)
const DevTestViewPage = !isProductionHost
  ? React.lazy(async () => {
      const mod = await import('./components/Pages/RequestPage/TestViewPage')
      return { default: mod.TestViewPage }
    })
  : undefined

const SiteRoutes = () => {
  const location = useLocation()

  useEffect(() => {
    // Capture the analytics handle inside the effect and depend on `location` only.
    // getAnalytics() returns a new reference once analytics.js replaces the stub, so
    // depending on it would fire a duplicate page view on initial load.
    const analytics = getAnalytics()
    analytics?.page()
  }, [location])

  return (
    <Routes>
      <Route path="/login" Component={LoginRouteGuard} />
      <Route path="/invalidRedirection" Component={InvalidRedirectionPage} />
      <Route path="/callback" Component={CallbackPage} />
      <Route path="/requests/:requestId" Component={RequestPageRoute} />
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
      <Route path="/quick-setup" Component={QuickSetupPage} />
      <Route path="/mobile" Component={MobileAuthPage} />
      <Route path="/mobile/callback" Component={MobileCallbackPage} />
      <Route path="*" Component={DefaultPage} />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectionProvider>
      <FeatureFlagsProvider>
        <TranslationProvider locale={initialLocale} translations={translations} fallbackLocale="en">
          <DclThemeProvider theme={darkTheme}>
            <BrowserRouter basename="/auth">
              <SiteRoutes />
            </BrowserRouter>
          </DclThemeProvider>
          <Intercom appId={config.get('INTERCOM_APP_ID')} settings={{ alignment: 'right' }} />
        </TranslationProvider>
      </FeatureFlagsProvider>
    </ConnectionProvider>
  </React.StrictMode>
)
