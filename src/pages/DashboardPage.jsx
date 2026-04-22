import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listBanks, listLPs, listClients, listAffinity, listAudit, getWeights
} from '../lib/dataStore.js';
import { useDataChange } from '../lib/dataEvents.js';
import { useQuickAdd } from '../lib/quickAddContext.jsx';
import sdmShield from '../assets/sdm-shield.svg';
import RoutingOverview from '../components/RoutingOverview.jsx';

export default function DashboardPage() {
  const [banks, setBanks] = useState([]);
  const [lps, setLps] = useState([]);
  const [clients, setClients] = useState([]);
  const [rules, setRules] = useState([]);
  const [audit, setAudit] = useState([]);
  const [weights, setWeights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();
  const { openQuickAdd } = useQuickAdd();

  async function load() {
    try {
      setLoading(true);
      const [b, l, c, r, a, w] = await Promise.all([
        listBanks(), listLPs(), listClients(), listAffinity(), listAudit(12), getWeights()
      ]);
      setBanks(b); setLps(l); setClients(c); setRules(r); setAudit(a); setWeights(w);
      setErr(null);
    } catch (e) { setErr(e.message ?? String(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('*', load);

  // ---------- derived stats ----------
  const stats = useMemo(() => ({
    clients: {
      total: clients.length,
      active: clients.filter(c => c.is_active !== false).length,
      byRisk: tally(clients, c => c.risk_rating, ['LOW', 'MEDIUM', 'HIGH']),
      byEntity: tally(clients, c => c.sdm_entity, ['SDM_INC', 'SDM_USA']),
      byPriority: tally(clients, c => c.priority_tier, ['P1', 'P2', 'P3'])
    },
    banks: {
      total: banks.length,
      active: banks.filter(b => b.is_active !== false).length,
      byTier: tally(banks, b => b.tier, ['T1', 'T1_CAD', 'T2', 'T2_SPECIALIST', 'T3', 'T3_DEDICATED']),
      byEntity: tally(banks, b => b.sdm_entity, ['SDM_INC', 'SDM_USA']),
      currenciesCovered: uniqueFlat(banks, b => b.supported_currencies)
    },
    lps: {
      total: lps.length,
      active: lps.filter(l => l.is_active !== false).length,
      currenciesCovered: uniqueFlat(lps, l => l.supported_currencies),
      networksCovered: uniqueFlat(lps, l => l.settlement_networks)
    },
    rules: {
      total: rules.length,
      active: rules.filter(r => r.is_active !== false).length,
      byCurrency: tally(rules, r => r.currency)
    }
  }), [banks, lps, clients, rules]);

  return (
    <>
      {err && <div className="error-banner">{err}</div>}

      {/* Hero — shield mark + ticker + title + actions */}
      <div className="dash-hero">
        <img src={sdmShield} alt="" className="dash-hero-shield-bg" aria-hidden="true" />
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <div className="dash-hero-kicker">
              <span className="dash-hero-kicker-dot" />
              SDM Atlas · Dashboard
            </div>
            <h1 className="dash-hero-title">
              <img src={sdmShield} alt="" className="dash-hero-shield-mark" />
              <span>Atlas</span>
              <span className="dash-hero-title-accent">Routing Engine</span>
            </h1>
            <p className="dash-hero-sub">
              Real-time view of SDM's banking and liquidity registry.
              {' '}
              <strong className="dash-hero-stat">{stats.clients.total} clients</strong> routed across
              {' '}<strong className="dash-hero-stat">{stats.banks.active} banks</strong> and
              {' '}<strong className="dash-hero-stat">{stats.lps.active} liquidity providers</strong>
              {' '}across <strong className="dash-hero-stat">{stats.banks.currenciesCovered.length} currencies</strong>.
            </p>
          </div>
          <div className="dash-hero-actions">
            <button className="btn primary large" onClick={() => navigate('/routing')}>
              Start Routing →
            </button>
            <button className="btn ghost large" onClick={() => openQuickAdd({ kind: 'client' })}>
              + Add Client
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI row */}
      <div className="dash-stats">
        <StatCard
          label="Clients"
          value={stats.clients.total}
          sub={`${stats.clients.active} active · ${stats.clients.byEntity.SDM_INC || 0} INC · ${stats.clients.byEntity.SDM_USA || 0} USA`}
          accent="amber"
          onClick={() => navigate('/registry/clients')}
        />
        <StatCard
          label="Banks"
          value={stats.banks.total}
          sub={`${stats.banks.active} active · covering ${stats.banks.currenciesCovered.length} currencies`}
          accent="green"
          onClick={() => navigate('/registry/banks')}
        />
        <StatCard
          label="Liquidity Providers"
          value={stats.lps.total}
          sub={`${stats.lps.active} active · on ${stats.lps.networksCovered.length} networks`}
          accent="blue"
          onClick={() => navigate('/registry/lps')}
        />
        <StatCard
          label="Affinity Rules"
          value={stats.rules.total}
          sub={`${stats.rules.active} active · across ${Object.keys(stats.rules.byCurrency).length} currencies`}
          accent="purple"
          onClick={() => navigate('/rules/affinity')}
        />
      </div>

      {/* Portfolio view — where each client is currently routed */}
      <RoutingOverview
        clients={clients}
        banks={banks}
        lps={lps}
        affinity={rules}
        weights={weights}
      />

      {/* Coverage row */}
      <div className="dash-coverage">
        <div className="dash-coverage-block">
          <div className="dash-coverage-label">Currencies Covered</div>
          <div className="dash-coverage-chips">
            {stats.banks.currenciesCovered.sort().map(c => (
              <span key={c} className="coverage-chip">{c}</span>
            ))}
            {stats.banks.currenciesCovered.length === 0 && (
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>none</span>
            )}
          </div>
        </div>
        <div className="dash-coverage-block">
          <div className="dash-coverage-label">Settlement Networks</div>
          <div className="dash-coverage-chips">
            {[...new Set(banks.flatMap(b => b.settlement_networks || []))].sort().map(n => (
              <span key={n} className="coverage-chip network">{n}</span>
            ))}
            {banks.length === 0 && (
              <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>none</span>
            )}
          </div>
        </div>
      </div>

      {/* Activity + Quick actions */}
      <div className="dash-row">
        <div className="dash-panel dash-activity">
          <div className="dash-panel-header">
            <h3>Recent Activity</h3>
            <a onClick={() => navigate('/audit')} style={{ cursor: 'pointer', fontSize: 12 }}>View all →</a>
          </div>
          {audit.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 12, padding: 8 }}>
              No activity yet. Edits to banks, LPs, clients, and rules appear here.
            </div>
          ) : (
            <ul className="activity-list">
              {audit.slice(0, 8).map(a => (
                <li key={a.audit_id}>
                  <span className="activity-time">{timeAgo(a.changed_at)}</span>
                  <span className={`activity-action activity-${a.action}`}>{a.action}</span>
                  <span className="activity-table mono">{a.table_name}</span>
                  <span className="activity-id mono">
                    {(a.new_values?.client_name || a.new_values?.bank_name ||
                      a.new_values?.lp_name || a.new_values?.label ||
                      String(a.record_id).slice(0, 8))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-panel dash-quick">
          <div className="dash-panel-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="dash-quick-grid">
            <QuickTile label="Start Routing"       sub="Compute a recommendation" onClick={() => navigate('/routing')} />
            <QuickTile label="+ Add Client"        sub="Onboard a new client"     onClick={() => openQuickAdd({ kind: 'client' })} />
            <QuickTile label="+ Add Bank"          sub="Register a bank"          onClick={() => openQuickAdd({ kind: 'bank' })} />
            <QuickTile label="+ Add LP"            sub="Register a liquidity provider" onClick={() => openQuickAdd({ kind: 'lp' })} />
            <QuickTile label="+ Affinity Rule"     sub="Pin a routing preference" onClick={() => openQuickAdd({ kind: 'affinity' })} />
            <QuickTile label="Scoring Weights"     sub="Tune the engine"          onClick={() => navigate('/rules/weights')} />
          </div>
        </div>
      </div>

      {loading && banks.length === 0 && (
        <div className="empty-state" style={{ marginTop: 20 }}>Loading registry…</div>
      )}
    </>
  );
}

// --------- helpers ---------

function tally(items, keyFn, preset) {
  const out = preset ? Object.fromEntries(preset.map(k => [k, 0])) : {};
  for (const x of items) {
    const k = keyFn(x);
    if (k == null) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function uniqueFlat(items, keyFn) {
  const s = new Set();
  for (const x of items) for (const v of (keyFn(x) || [])) s.add(v);
  return [...s];
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (isNaN(diff)) return '';
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <button className={`stat-card stat-${accent}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </button>
  );
}

function BarList({ items, emptyText }) {
  const max = Math.max(1, ...items.map(i => i.value));
  if (!items.length) {
    return <div style={{ color: 'var(--text-faint)', fontSize: 12, padding: 8 }}>{emptyText}</div>;
  }
  return (
    <div className="bar-list">
      {items.map(item => (
        <div className="bar-row" key={item.label}>
          <div className="bar-label">
            <span className={item.className || ''}>{item.label}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <div className="bar-count mono">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function QuickTile({ label, sub, onClick }) {
  return (
    <button className="quick-tile" onClick={onClick}>
      <div className="quick-tile-label">{label}</div>
      <div className="quick-tile-sub">{sub}</div>
    </button>
  );
}
