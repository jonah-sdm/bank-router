import { useMemo, useState } from 'react';

// Scrollable client browser for the Routing page.
// - Sticky search + count + "new client" button at top
// - Virtual-less list of all clients below (client-side filter)
// - Selected client is highlighted; click to load
//
// Scales to thousands of clients — filter is O(N) string includes, well under
// 16ms even at 10k rows.
export default function ClientListSidebar({ clients, selectedId, onSelect, onNew }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q) return clients;
    const s = q.toLowerCase().trim();
    return clients.filter(c =>
      c.client_name?.toLowerCase().includes(s) ||
      c.business_vertical?.toLowerCase().includes(s) ||
      c.jurisdiction_country?.toLowerCase().includes(s) ||
      c.risk_rating?.toLowerCase().includes(s) ||
      (c.settlement_currencies || []).join(',').toLowerCase().includes(s)
    );
  }, [clients, q]);

  return (
    <div className="client-sidebar">
      <div className="client-sidebar-sticky">
        <div className="client-sidebar-header">
          <h3>Clients</h3>
          <span className="client-sidebar-count">
            {q
              ? `${filtered.length} of ${clients.length}`
              : `${clients.length} total`}
          </span>
        </div>

        <div className="client-sidebar-search">
          <span className="client-sidebar-search-icon" aria-hidden>⌕</span>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search clients…"
          />
          {q && (
            <button
              type="button"
              className="client-sidebar-search-clear"
              onClick={() => setQ('')}
              aria-label="Clear search"
            >×</button>
          )}
        </div>

        <button
          type="button"
          className={`client-sidebar-new ${!selectedId ? 'active' : ''}`}
          onClick={onNew}
        >
          <span className="new-plus">+</span>
          <span className="new-label">New client / manual input</span>
        </button>
      </div>

      <div className="client-sidebar-list">
        {filtered.length === 0 ? (
          <div className="client-sidebar-empty">
            {q
              ? <>No clients match <strong>"{q}"</strong>.</>
              : <>No clients yet. Click <strong>+ New client</strong> above to add one.</>}
          </div>
        ) : (
          filtered.map(c => (
            <button
              key={c.client_id}
              type="button"
              className={`client-sidebar-item ${c.client_id === selectedId ? 'selected' : ''}`}
              onClick={() => onSelect(c.client_id)}
            >
              <div className="csi-row">
                <span className="csi-name">{c.client_name}</span>
                {c.risk_rating && (
                  <span className={`csi-risk cp-risk-${c.risk_rating}`}>{c.risk_rating}</span>
                )}
              </div>
              <div className="csi-meta">
                <span className="mono">{c.business_vertical || '—'}</span>
                <span className="csi-dot">·</span>
                <span className="mono">{c.jurisdiction_country || '—'}</span>
                {c.settlement_currencies?.length > 0 && (
                  <>
                    <span className="csi-dot">·</span>
                    <span className="mono">{c.settlement_currencies.join(',')}</span>
                  </>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
