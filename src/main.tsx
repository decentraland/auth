/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/naming-convention */
import 'semantic-ui-css/semantic.min.css'
import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import 'decentraland-ui/dist/themes/alternative/dark-theme.css'
import './index.css'

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<p>Login</p>} />
        <Route path="/callback" element={<p>Callback</p>} />
        <Route path="/user" element={<p>User</p>} />
        <Route path="*" element={<p>Default</p>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
)
