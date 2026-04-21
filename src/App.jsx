import { NavLink, Outlet } from 'react-router-dom';
import { HAS_SUPABASE } from './lib/supabase.js';
import { QuickAddProvider } from './lib/quickAddContext.jsx';
import NavDropdown from './components/NavDropdown.jsx';
import QuickAdd from './components/QuickAdd.jsx';
import QuickAddHost from './components/QuickAddHost.jsx';

export default function App() {
  return (
    <QuickAddProvider>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            <span>
              SDM Atlas
              <span className="kicker" style={{ marginLeft: 10 }}>Routing Engine</span>
            </span>
          </div>

          <nav className="topnav">
            <NavLink to="/routing" className={({ isActive }) => isActive ? 'active' : ''}>
              Routing
            </NavLink>

            <NavDropdown
              label="Registry"
              matchPaths={['/registry', '/admin/banks', '/admin/lps', '/admin/clients']}
              items={[
                { to: '/registry/banks',   label: 'Banks' },
                { to: '/registry/lps',     label: 'LPs' },
                { to: '/registry/clients', label: 'Clients' }
              ]}
            />

            <NavDropdown
              label="Rules"
              matchPaths={['/rules', '/admin/affinity', '/admin/weights']}
              items={[
                { to: '/rules/affinity', label: 'Affinity Rules' },
                { to: '/rules/weights',  label: 'Scoring Weights' }
              ]}
            />

            <NavLink to="/audit" className={({ isActive }) => isActive ? 'active' : ''}>
              Audit
            </NavLink>
          </nav>

          <div className="topbar-right">
            <QuickAdd />
          </div>
        </header>

        <main className="page">
          {!HAS_SUPABASE && (
            <div className="info-banner">
              <strong>DEMO MODE</strong> — Supabase not configured. Running on in-memory mock data.
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to persist.
            </div>
          )}
          <Outlet />
        </main>

        <QuickAddHost />
      </div>
    </QuickAddProvider>
  );
}
