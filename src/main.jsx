import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RoutingPage from './pages/RoutingPage.jsx'
import BanksPage from './pages/registry/BanksPage.jsx'
import LPsPage from './pages/registry/LPsPage.jsx'
import ClientsPage from './pages/registry/ClientsPage.jsx'
import AffinityPage from './pages/rules/AffinityPage.jsx'
import WeightsPage from './pages/rules/WeightsPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PasswordGate>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="routing" element={<RoutingPage />} />

          <Route path="registry/banks"    element={<BanksPage />} />
          <Route path="registry/lps"      element={<LPsPage />} />
          <Route path="registry/clients"  element={<ClientsPage />} />
          <Route path="registry" element={<Navigate to="/registry/banks" replace />} />

          <Route path="rules/affinity" element={<AffinityPage />} />
          <Route path="rules/weights"  element={<WeightsPage />} />
          <Route path="rules" element={<Navigate to="/rules/affinity" replace />} />

          <Route path="audit" element={<AuditPage />} />

          {/* Legacy /admin/* redirects — keep for one release so bookmarks don't break */}
          <Route path="admin"           element={<Navigate to="/registry/banks" replace />} />
          <Route path="admin/banks"     element={<Navigate to="/registry/banks" replace />} />
          <Route path="admin/lps"       element={<Navigate to="/registry/lps" replace />} />
          <Route path="admin/clients"   element={<Navigate to="/registry/clients" replace />} />
          <Route path="admin/affinity"  element={<Navigate to="/rules/affinity" replace />} />
          <Route path="admin/weights"   element={<Navigate to="/rules/weights" replace />} />
          <Route path="admin/audit"     element={<Navigate to="/audit" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </PasswordGate>
  </React.StrictMode>
)
