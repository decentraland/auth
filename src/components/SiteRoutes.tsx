/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import * as React from 'react'
import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Env } from '@dcl/ui-env'
import { RequestPage } from './Pages/RequestPage'
import { SetupPage } from './Pages/SetupPage'
import { DefaultPage } from './Pages/DefaultPage'
import { AvatarSetupPage } from './Pages/AvatarSetupPage/AvatarSetupPage'
import { CallbackPage } from './Pages/CallbackPage'
import { InvalidRedirectionPage } from './Pages/InvalidRedirectionPage'
import { LoginPage } from './Pages/LoginPage'
import { MobileAuthPage } from './Pages/MobileAuthPage'
import { MobileCallbackPage } from './Pages/MobileCallbackPage'
import { config } from '../modules/config'
import { getAnalytics } from '../modules/analytics/segment'

const DevTestViewPage = !config.is(Env.PRODUCTION)
  ? React.lazy(async () => {
      const mod = await import('./Pages/RequestPage/TestViewPage')
      return { default: mod.TestViewPage }
    })
  : undefined

export const SiteRoutes = () => {
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
