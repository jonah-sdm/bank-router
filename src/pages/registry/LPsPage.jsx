import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import LPEditor from '../../components/LPEditor.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SearchBox from '../../components/SearchBox.jsx';
import { listLPs, upsertLP, deleteLP, listBanks } from '../../lib/dataStore.js';
import { useDataChange } from '../../lib/dataEvents.js';

export default function LPsPage() {
  const [rows, setRows] = useState([]);
  const [banks, setBanks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);

  async function load() {
    try {
      const [lps, bks] = await Promise.all([listLPs(), listBanks()]);
      setRows(lps); setBanks(bks); setErr(null);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('lps', load);
  useDataChange('banks', load);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(l =>
      l.lp_name?.toLowerCase().includes(s) ||
      (l.supported_currencies || []).join(',').toLowerCase().includes(s) ||
      (l.settlement_networks || []).join(',').toLowerCase().includes(s)
    );
  }, [rows, q]);

  async function save() {
    try { await upsertLP(editing); setEditing(null); }
    catch (e) { setErr(e.message); }
  }
  async function remove() {
    if (!toDelete) return;
    try { await deleteLP(toDelete.lp_id); setToDelete(null); }
    catch (e) { setErr(e.message); setToDelete(null); }
  }

  return (
    <>
      <h1 className="page-title">Liquidity Providers</h1>
      <p className="page-sub">LPs that can settle to our banks. {rows.length} total.</p>
      {err && <div className="error-banner">{err}</div>}

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search LPs, currency, network…" />
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing({
          lp_name: '', supported_currencies: [], settlement_networks: [],
          preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true, notes: ''
        })}>+ Add LP</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>LP</th><th>Currencies</th><th>Networks</th>
              <th>Preferred Banks</th><th>Risk</th><th>Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const prefNames = (l.preferred_banks || [])
                .map(id => banks.find(b => b.bank_id === id)?.bank_name || id).join(', ');
              return (
                <tr key={l.lp_id}>
                  <td><strong>{l.lp_name}</strong></td>
                  <td className="mono">{(l.supported_currencies || []).join(', ')}</td>
                  <td className="mono">{(l.settlement_networks || []).join(', ')}</td>
                  <td className="mono" style={{ color: 'var(--text-dim)' }}>{prefNames || '— any —'}</td>
                  <td><span className={`badge risk-${l.risk_tolerance}`}>{l.risk_tolerance}</span></td>
                  <td>{l.is_active ? '●' : '○'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn small" onClick={() => setEditing({ ...l })}>Edit</button>
                      <button className="btn small danger" onClick={() => setToDelete(l)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 30 }}>
                {q ? 'No LPs match the search.' : 'No LPs yet. Click + Add LP to create one.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.lp_id ? `Edit ${editing.lp_name}` : 'Add LP'}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn primary" onClick={save}>Save</button>
          </>}>
          <LPEditor value={editing} onChange={setEditing} banks={banks} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.lp_name}?`}
        body="This cannot be undone."
        confirmLabel="Delete LP"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
