import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeRouting } from '../engine/routing.js';
import { countryName } from '../lib/countries.js';

// Unified portfolio view — 4 colored stat cards + aggregate routing stats +
// 3 bar panels. Runs the engine across every client to show where the
// portfolio is placed right now.
export default function RoutingOverview({ clients, banks, lps, affinity, weights }) {
  const navigate = useNavigate();

  // ---- compute routings for every client ----
  const allRoutings = useMemo(() => {
    if (!weights || banks.length === 0) return [];
    return clients.map(c => {
      try {
        return { client: c, legs: computeRouting(c, banks, lps, weights, affinity) };
      } catch {
        return { client: c, legs: [] };
      }
    });
  }, [clients, banks, lps, weights, affinity]);

  // ---- aggregations ----
  const stats = useMemo(() => {
    const bankClients = {};
    const bankJurisdictions = {};
    const jurisdictionCount = {};
    const currencyLegCount = {};
    let totalLegs = 0;
    let highConfLegs = 0;
    let instantLegs = 0;

    for (const { client, legs } of allRoutings) {
      if (client.jurisdiction_country) {
        jurisdictionCount[client.jurisdiction_country] =
          (jurisdictionCount[client.jurisdiction_country] || 0) + 1;
      }
      for (const leg of legs) {
        totalLegs++;
        if (leg.confidence === 'HIGH') highConfLegs++;
        if (['CUBIX', 'BLINK', 'RIPPLE_ODL'].includes(leg.settlement_network)) instantLegs++;

        currencyLegCount[leg.currency_leg] = (currencyLegCount[leg.currency_leg] || 0) + 1;

        if (leg.recommended_bank) {
          const bn = leg.recommended_bank.bank_name;
          if (!bankClients[bn]) bankClients[bn] = new Set();
          bankClients[bn].add(client.client_id);

          if (client.jurisdiction_country) {
            if (!bankJurisdictions[bn]) bankJurisdictions[bn] = new Set();
            bankJurisdictions[bn].add(client.jurisdiction_country);
          }
        }
      }
    }

    const byBank = Object.entries(bankClients)
      .map(([name, set]) => ({
        label: name,
        value: set.size,
        jurisdictions: [...(bankJurisdictions[name] || [])]
      }))
      .sort((a, b) => b.value - a.value);

    const byJurisdiction = Object.entries(jurisdictionCount)
      .map(([code, count]) => {
        const name = countryName(code);
        return {
          label: name === code ? code : `${name} · ${code}`,
          code,
          value: count
        };
      })
      .sort((a, b) => b.value - a.value);

    const byCurrency = Object.entries(currencyLegCount)
      .map(([ccy, count]) => ({ label: ccy, value: count }))
      .sort((a, b) => b.value - a.value);

    const clientsByEntity = tally(clients, c => c.sdm_entity, ['SDM_INC', 'SDM_USA']);
    const activeBanks = banks.filter(b => b.is_active !== false).length;
    const activeLps = lps.filter(l => l.is_active !== false).length;
    const activeRules = affinity.filter(r => r.is_active !== false).length;
    const currenciesCovered = uniqueFlat(banks, b => b.supported_currencies);
    const networksCovered = uniqueFlat(lps, l => l.settlement_networks);

    return {
      totalClients: clients.length,
      totalLegs,
      banksActive: Object.keys(bankClients).length,
      jurisdictionsCount: Object.keys(jurisdictionCount).length,
      highConfPct: totalLegs > 0 ? Math.round((highConfLegs / totalLegs) * 100) : 0,
      instantPct: totalLegs > 0 ? Math.round((instantLegs / totalLegs) * 100) : 0,
      byBank,
      byJurisdiction,
      byCurrency,
      registry: {
        clients: clients.length,
        banks: banks.length,
        lps: lps.length,
        rules: affinity.length,
        activeBanks, activeLps, activeRules,
        clientsINC: clientsByEntity.SDM_INC || 0,
        clientsUSA: clientsByEntity.SDM_USA || 0,
        currenciesCovered: currenciesCovered.length,
        networksCovered: networksCovered.length,
        ruleCurrencies: [...new Set(affinity.map(r => r.currency))].length
      }
    };
  }, [allRoutings, clients, banks, lps, affinity]);

  const hasData = clients.length > 0 && banks.length > 0;

  return (
    <div className="routing-overview">
      <div className="routing-overview-header">
        <div>
          <div className="routing-overview-kicker">Portfolio View</div>
          <h2 className="routing-overview-title">Where Your Clients Are Routed</h2>
          <p className="routing-overview-sub">
            Live aggregate of the engine's recommendation for every client in the registry.
            {' '}Re-computes instantly when banks, LPs, or affinity rules change.
          </p>
        </div>
      </div>

      {/* Registry + portfolio metrics — colored stat cards */}
      <div className="routing-overview-stats">
        <StatCard
          label="Clients"
          value={stats.registry.clients}
          sub={`${stats.registry.clientsINC} INC · ${stats.registry.clientsUSA} USA`}
          accent="amber"
          onClick={() => navigate('/registry/clients')}
        />
        <StatCard
          label="Banks"
          value={stats.registry.banks}
          sub={`${stats.registry.activeBanks} active · ${stats.banksActive} in use today`}
          accent="green"
          onClick={() => navigate('/registry/banks')}
        />
        <StatCard
          label="Liquidity Providers"
          value={stats.registry.lps}
          sub={`${stats.registry.activeLps} active · on ${stats.registry.networksCovered} networks`}
          accent="blue"
          onClick={() => navigate('/registry/lps')}
        />
        <StatCard
          label="Affinity Rules"
          value={stats.registry.rules}
          sub={`${stats.registry.activeRules} active · across ${stats.registry.ruleCurrencies} currencies`}
          accent="purple"
          onClick={() => navigate('/rules/affinity')}
        />
      </div>

      {/* Aggregate portfolio stats bar */}
      <div className="routing-overview-metrics">
        <div className="roi-metric">
          <span className="roi-metric-v">{stats.jurisdictionsCount}</span>
          <span className="roi-metric-k">jurisdictions</span>
        </div>
        <div className="roi-metric">
          <span className="roi-metric-v">{stats.totalLegs}</span>
          <span className="roi-metric-k">currency legs</span>
        </div>
        <div className="roi-metric amber">
          <span className="roi-metric-v">{stats.highConfPct}%</span>
          <span className="roi-metric-k">high confidence</span>
        </div>
        <div className="roi-metric amber">
          <span className="roi-metric-v">{stats.instantPct}%</span>
          <span className="roi-metric-k">instant settlement</span>
        </div>
      </div>

      {!hasData ? (
        <div className="routing-overview-empty">
          Load clients and banks to see the portfolio routing breakdown.
        </div>
      ) : (
        <div className="routing-overview-grid">
          {/* Clients by Bank */}
          <div className="roi-panel">
            <div className="roi-panel-header">
              <h3>Clients by Bank</h3>
              <span className="roi-panel-meta">{stats.banksActive} banks in use</span>
            </div>
            {stats.byBank.length === 0 ? (
              <div className="roi-empty">No routed clients yet.</div>
            ) : (
              <div className="roi-bar-list">
                {stats.byBank.map(item => (
                  <div className="roi-bar-row" key={item.label}>
                    <div className="roi-bar-label">
                      <div className="roi-bar-name">{item.label}</div>
                      <div className="roi-bar-sub">
                        {item.jurisdictions.length > 0
                          ? item.jurisdictions.slice(0, 6).join(' · ') +
                            (item.jurisdictions.length > 6
                              ? ` +${item.jurisdictions.length - 6}` : '')
                          : '—'}
                      </div>
                    </div>
                    <div className="roi-bar-track">
                      <div
                        className="roi-bar-fill"
                        style={{ width: `${(item.value / stats.byBank[0].value) * 100}%` }}
                      />
                    </div>
                    <div className="roi-bar-count mono">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clients by Jurisdiction */}
          <div className="roi-panel">
            <div className="roi-panel-header">
              <h3>Clients by Jurisdiction</h3>
              <span className="roi-panel-meta">{stats.jurisdictionsCount} countries</span>
            </div>
            {stats.byJurisdiction.length === 0 ? (
              <div className="roi-empty">No jurisdictions set.</div>
            ) : (
              <div className="roi-bar-list">
                {stats.byJurisdiction.slice(0, 8).map(item => (
                  <div className="roi-bar-row" key={item.code}>
                    <div className="roi-bar-label">
                      <div className="roi-bar-name">{item.label}</div>
                    </div>
                    <div className="roi-bar-track">
                      <div
                        className="roi-bar-fill"
                        style={{ width: `${(item.value / stats.byJurisdiction[0].value) * 100}%` }}
                      />
                    </div>
                    <div className="roi-bar-count mono">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Currency legs */}
          <div className="roi-panel">
            <div className="roi-panel-header">
              <h3>Currency Legs</h3>
              <span className="roi-panel-meta">{stats.totalLegs} total</span>
            </div>
            {stats.byCurrency.length === 0 ? (
              <div className="roi-empty">No legs computed yet.</div>
            ) : (
              <div className="roi-currency-grid">
                {stats.byCurrency.map(item => (
                  <div className="roi-currency-chip" key={item.label}>
                    <div className="roi-currency-ccy">{item.label}</div>
                    <div className="roi-currency-count mono">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --------- local helpers ---------
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

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <button className={`stat-card stat-${accent}`} onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </button>
  );
}
