import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import AdminApp from './AdminApp'
import Terms from './components/Terms'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
