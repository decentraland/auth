/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import './polyfills.ts'
import 'semantic-ui-css/semantic.min.css'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { BrowserRouter } from 'react-router-dom'
import { darkTheme, DclThemeProvider } from 'decentraland-ui2'
import { SiteRoutes } from './components/SiteRoutes'
import Intercom from './components/Intercom'
import { FeatureFlagsProvider } from './components/FeatureFlagsProvider'
import { config } from './modules/config'
import { getAnalytics } from './modules/analytics/segment'
import './modules/analytics/snippet'
import './modules/analytics/sentry'
import 'decentraland-ui/dist/themes/alternative/dark-theme.css'
import './index.css'

getAnalytics()?.load(config.get('SEGMENT_API_KEY'))

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
