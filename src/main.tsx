/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import 'semantic-ui-css/semantic.min.css'
import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequestPage } from './components/Pages/RequestPage'
import { SetupPage } from './components/Pages/SetupPage'
import { DefaultPage } from './components/Pages/DefaultPage'
import { CallbackPage } from './components/Pages/CallbackPage'
import { LoginPage } from './components/Pages/LoginPage'
import { FeatureFlagsProvider } from './components/FeatureFlagsProvider'
import { config } from './modules/config'
import { getAnalytics } from './modules/analytics/segment'
import './modules/analytics/snippet'
import 'decentraland-ui/dist/themes/alternative/dark-theme.css'
import './index.css'

getAnalytics().load(config.get('SEGMENT_API_KEY'))

ReactDOM.render(
  <React.StrictMode>
    <FeatureFlagsProvider>
      <BrowserRouter basename="/auth">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/requests/:requestId" element={<RequestPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="*" element={<DefaultPage />} />
        </Routes>
      </BrowserRouter>
    </FeatureFlagsProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
