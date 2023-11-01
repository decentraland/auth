/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import 'semantic-ui-css/semantic.min.css'
import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './components/Pages/LoginPage'
import { CallbackPage } from './components/Pages/CallbackPage'
import 'decentraland-ui/dist/themes/alternative/dark-theme.css'
import './index.css'

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
)
