import { useEffect, useMemo, useState } from 'react';
import SearchBox from '../components/SearchBox.jsx';
import { listAudit } from '../lib/dataStore.js';
import { useDataChange } from '../lib/dataEvents.js';

export default function AuditPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [tableFilter, setTableFilter] = useState('');

  async function load() {
    try { setRows(await listAudit(500)); setErr(null); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('*', load);   // any mutation anywhere refreshes this page

  const tables = useMemo(() => [...new Set(rows.map(r => r.table_name))].sort(), [rows]);

  const shown = useMemo(() => {
    let r = tableFilter ? rows.filter(x => x.table_name === tableFilter) : rows;
    if (q) {
      const s = q.toLowerCase();
      r = r.filter(x =>
        x.table_name?.toLowerCase().includes(s) ||
        x.action?.toLowerCase().includes(s) ||
        String(x.record_id).toLowerCase().includes(s) ||
        JSON.stringify(x.new_values || {}).toLowerCase().includes(s)
      );
    }
    return r;
  }, [rows, q, tableFilter]);

  return (
    <>
      <h1 className="page-title">Audit Log</h1>
      <p className="page-sub">Every insert, update, and delete across banks, LPs, clients, rules, and weights. {rows.length} entries.</p>
      {err && <div className="error-banner">{err}</div>}

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search action, table, record ID, values…" />
        <select value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
          <option value="">All tables ({rows.length})</option>
          {tables.map(t => <option key={t} value={t}>{t} ({rows.filter(r => r.table_name === t).length})</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>When</th><th>Table</th><th>Action</th><th>Record ID</th><th>Changed By</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.audit_id}>
                <td className="mono">{new Date(r.changed_at).toLocaleString()}</td>
                <td className="mono">{r.table_name}</td>
                <td><span className="badge">{r.action}</span></td>
                <td className="mono" style={{ color: 'var(--text-faint)' }}>{String(r.record_id).slice(0, 12)}</td>
                <td className="mono" style={{ color: 'var(--text-faint)' }}>{r.changed_by?.slice?.(0, 8) || '—'}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 30 }}>
                {q || tableFilter ? 'No entries match the filter.' : 'No audit entries yet. Make a change in any admin section to see it logged here.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
