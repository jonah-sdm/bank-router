import { useMemo } from 'react';
import { computeRouting } from '../engine/routing.js';
import { countryName } from '../lib/countries.js';

// Aggregate routing dashboard — runs the engine across every client in the
// registry and shows where the portfolio is placed today.
export default function RoutingOverview({ clients, banks, lps, affinity, weights }) {
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
    const bankClients = {};              // bank_name → Set<client_id>
    const bankJurisdictions = {};        // bank_name → Set<country>
    const jurisdictionCount = {};        // country → clients count
    const currencyLegCount = {};         // ccy → leg count
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

    return {
      totalClients: clients.length,
      totalLegs,
      banksActive: Object.keys(bankClients).length,
      jurisdictionsCount: Object.keys(jurisdictionCount).length,
      highConfPct: totalLegs > 0 ? Math.round((highConfLegs / totalLegs) * 100) : 0,
      instantPct: totalLegs > 0 ? Math.round((instantLegs / totalLegs) * 100) : 0,
      byBank,
      byJurisdiction,
      byCurrency
    };
  }, [allRoutings, clients]);

  const hasData = clients.length > 0 && banks.length > 0;

  return (
    <div className="routing-overview">
      <div className="routing-overview-header">
        <div>
          <div className="routing-overview-kicker">Portfolio View</div>
          <h2 className="routing-overview-title">
            Where Your Clients Are Routed
          </h2>
          <p className="routing-overview-sub">
            Live aggregate of the engine's recommendation for every client in the registry.
            {' '}Re-computes instantly when banks, LPs, or affinity rules change.
          </p>
        </div>
        <div className="routing-overview-stat-inline">
          <div className="roi-stat">
            <div className="roi-stat-v">{stats.totalClients}</div>
            <div className="roi-stat-k">clients</div>
          </div>
          <div className="roi-stat">
            <div className="roi-stat-v">{stats.banksActive}</div>
            <div className="roi-stat-k">banks in use</div>
          </div>
          <div className="roi-stat">
            <div className="roi-stat-v">{stats.jurisdictionsCount}</div>
            <div className="roi-stat-k">jurisdictions</div>
          </div>
          <div className="roi-stat">
            <div className="roi-stat-v">{stats.totalLegs}</div>
            <div className="roi-stat-k">currency legs</div>
          </div>
          <div className="roi-stat amber">
            <div className="roi-stat-v">{stats.highConfPct}%</div>
            <div className="roi-stat-k">high confidence</div>
          </div>
          <div className="roi-stat amber">
            <div className="roi-stat-v">{stats.instantPct}%</div>
            <div className="roi-stat-k">instant settlement</div>
          </div>
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
