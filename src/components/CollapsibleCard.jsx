import { useEffect, useState } from 'react';

// Reusable card with a collapse/expand toggle in the header.
// Pass a `storageKey` to persist collapse state across reloads via localStorage.
// `summary` is an optional node shown in the header when collapsed (e.g. the
// current value of what's hidden).
// `headerRight` is an optional node pinned to the right side of the header,
// visible regardless of collapse state (e.g. Save / Discard action buttons).
export default function CollapsibleCard({
  title,
  summary = null,
  defaultCollapsed = false,
  storageKey,
  headerRight = null,
  children
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (!storageKey) return defaultCollapsed;
    try {
      const v = localStorage.getItem(storageKey);
      return v === null ? defaultCollapsed : v === '1';
    } catch { return defaultCollapsed; }
  });

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, collapsed ? '1' : '0'); } catch {}
  }, [collapsed, storageKey]);

  return (
    <div className="card collapsible">
      <div className="card-header" style={{ marginBottom: collapsed ? 0 : 16 }}>
        <button
          className="collapse-toggle"
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          type="button"
        >
          <span className={`chev ${collapsed ? '' : 'open'}`}>▸</span>
          <h3 style={{ margin: 0 }}>{title}</h3>
        </button>
        {collapsed && summary && <span className="hint">{summary}</span>}
        {headerRight && <div className="card-header-right">{headerRight}</div>}
      </div>
      {!collapsed && children}
    </div>
  );
}
