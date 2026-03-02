/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import './polyfills.ts'
import * as React from 'react'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DclThemeProvider, darkTheme } from 'decentraland-ui2'
import { TranslationProvider } from '@dcl/hooks'
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
import { translations } from './modules/translations'
import { getAnalytics } from './modules/analytics/segment'
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
  </React.StrictMode>
)
