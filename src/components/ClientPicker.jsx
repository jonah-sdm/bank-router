import { useEffect, useMemo, useRef, useState } from 'react';

// Searchable client picker. Scales to thousands of clients — type to filter,
// arrow keys to navigate, Enter to select, Esc to close.
//
//   <ClientPicker
//     clients={clients}
//     value={selectedClientId}
//     onChange={id => loadClient(id)}
//   />
//
// Matches on: client_name, business_vertical, jurisdiction_country, risk_rating.
export default function ClientPicker({ clients = [], value, onChange, placeholder = 'Search clients…' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const ref = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => clients.find(c => c.client_id === value),
    [clients, value]
  );

  const filtered = useMemo(() => {
    if (!q) return clients;
    const s = q.toLowerCase();
    return clients.filter(c =>
      c.client_name?.toLowerCase().includes(s) ||
      c.business_vertical?.toLowerCase().includes(s) ||
      c.jurisdiction_country?.toLowerCase().includes(s) ||
      c.risk_rating?.toLowerCase().includes(s) ||
      (c.settlement_currencies || []).join(',').toLowerCase().includes(s)
    );
  }, [clients, q]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Reset focused item when filter changes
  useEffect(() => { setFocusIdx(0); }, [q, open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children?.[focusIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setFocusIdx(i => Math.min(i + 1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Index 0 reserved for "new client / manual input"
      if (focusIdx === 0) { pick(''); return; }
      const c = filtered[focusIdx - 1];
      if (c) pick(c.client_id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function pick(id) {
    onChange(id);
    setOpen(false);
    setQ('');
  }

  function clearAndReset(e) {
    e.stopPropagation();
    pick('');
  }

  // The input shows either the live search query or the selected client name
  const displayValue = open
    ? q
    : (selected ? `${selected.client_name} · ${selected.business_vertical} · ${selected.jurisdiction_country} · ${selected.risk_rating}` : '');

  return (
    <div className="client-picker" ref={ref}>
      <div className={`client-picker-input ${open ? 'open' : ''} ${selected ? 'has-value' : ''}`}>
        <span className="client-picker-icon" aria-hidden>⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selected ? '' : placeholder}
        />
        {selected && !open && (
          <button type="button" className="client-picker-clear" onClick={clearAndReset} title="Clear and enter new client">×</button>
        )}
        <span className="client-picker-chev">{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <div className="client-picker-menu" ref={listRef} role="listbox">
          <div
            role="option"
            className={`client-picker-item new ${focusIdx === 0 ? 'focused' : ''}`}
            onMouseEnter={() => setFocusIdx(0)}
            onMouseDown={e => { e.preventDefault(); pick(''); }}
          >
            <span className="cp-name">— New client / manual input —</span>
          </div>

          {filtered.length === 0 && (
            <div className="client-picker-empty">
              No clients match "{q}".
            </div>
          )}

          {filtered.map((c, i) => (
            <div
              key={c.client_id}
              role="option"
              aria-selected={c.client_id === value}
              className={`client-picker-item ${focusIdx === i + 1 ? 'focused' : ''} ${c.client_id === value ? 'selected' : ''}`}
              onMouseEnter={() => setFocusIdx(i + 1)}
              onMouseDown={e => { e.preventDefault(); pick(c.client_id); }}
            >
              <span className="cp-name">{c.client_name}</span>
              <span className="cp-meta mono">
                {c.business_vertical} · {c.jurisdiction_country}
                {' · '}
                <span className={`cp-risk cp-risk-${c.risk_rating}`}>{c.risk_rating}</span>
                {c.settlement_currencies?.length > 0 && (
                  <> · {c.settlement_currencies.join(',')}</>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {clients.length > 0 && (
        <div className="client-picker-count">
          {q
            ? `${filtered.length} of ${clients.length} matching "${q}"`
            : `${clients.length} client${clients.length === 1 ? '' : 's'} in registry`}
        </div>
      )}
    </div>
  );
}
