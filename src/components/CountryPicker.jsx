import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, findCountry } from '../lib/countries.js';

// Searchable country picker that stores ISO-2 codes but lets users type
// however they want: country name, ISO-2, common aliases ("UK" → GB,
// "UAE" → AE, "USA" → US, "London" → GB, etc.)
//
//   <CountryPicker value={profile.jurisdiction_country}
//     onChange={code => setProfile({ ...profile, jurisdiction_country: code })}
//     placeholder="Jurisdiction" />
export default function CountryPicker({ value, onChange, placeholder = 'Country…' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const ref = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(() => findCountry(value), [value]);

  const filtered = useMemo(() => {
    if (!q) return COUNTRIES;
    const s = q.toLowerCase().trim();
    return COUNTRIES.filter(c => {
      if (c.code.toLowerCase() === s) return true;
      if (c.code.toLowerCase().startsWith(s)) return true;
      if (c.name.toLowerCase().includes(s)) return true;
      return (c.aliases || []).some(a => a.toLowerCase().includes(s));
    });
  }, [q]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => { setFocusIdx(0); }, [q, open]);
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children?.[focusIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setFocusIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = filtered[focusIdx];
      if (c) pick(c.code);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Backspace' && !q && selected) {
      // Backspace with empty search clears the selection
      pick('');
    }
  }

  function pick(code) {
    onChange(code);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  }

  const displayValue = open
    ? q
    : (selected ? `${selected.name} · ${selected.code}` : '');

  return (
    <div className="country-picker" ref={ref}>
      <div className={`country-picker-input ${open ? 'open' : ''} ${selected ? 'has-value' : ''}`}>
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
          <button type="button" className="country-picker-clear"
            onClick={e => { e.stopPropagation(); pick(''); }}
            title="Clear country">×</button>
        )}
        <span className="country-picker-chev">{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <div className="country-picker-menu" ref={listRef} role="listbox">
          {filtered.length === 0 ? (
            <div className="country-picker-empty">
              No match for "{q}". Countries use <strong>ISO-2</strong> codes
              (e.g. <span className="mono">GB</span> for UK, <span className="mono">AE</span> for UAE).
            </div>
          ) : filtered.map((c, i) => (
            <div
              key={c.code}
              role="option"
              aria-selected={c.code === value}
              className={`country-picker-item ${focusIdx === i ? 'focused' : ''} ${c.code === value ? 'selected' : ''}`}
              onMouseEnter={() => setFocusIdx(i)}
              onMouseDown={e => { e.preventDefault(); pick(c.code); }}
            >
              <span className="cp-country-name">{c.name}</span>
              <span className="cp-country-code mono">{c.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
