import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import BankEditor from '../../components/BankEditor.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SearchBox from '../../components/SearchBox.jsx';
import { listBanks, upsertBank, deleteBank } from '../../lib/dataStore.js';
import { useDataChange } from '../../lib/dataEvents.js';

export default function BanksPage() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);

  async function load() {
    try { setRows(await listBanks()); setErr(null); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('banks', load);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(b =>
      b.bank_name?.toLowerCase().includes(s) ||
      b.tier?.toLowerCase().includes(s) ||
      b.sdm_entity?.toLowerCase().includes(s) ||
      (b.supported_currencies || []).join(',').toLowerCase().includes(s)
    );
  }, [rows, q]);

  async function save() {
    try { await upsertBank(editing); setEditing(null); }
    catch (e) { setErr(e.message); }
  }
  async function remove() {
    if (!toDelete) return;
    try { await deleteBank(toDelete.bank_id); setToDelete(null); }
    catch (e) { setErr(e.message); setToDelete(null); }
  }

  return (
    <>
      <h1 className="page-title">Banks</h1>
      <p className="page-sub">Banking partners available for routing. {rows.length} total.</p>
      {err && <div className="error-banner">{err}</div>}

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search banks, tier, currency…" />
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing({
          bank_name: '', tier: 'T2', sdm_entity: 'SDM_INC',
          supported_currencies: [], settlement_networks: [],
          max_client_risk: 'MEDIUM', accepts_individuals: true,
          blocked_verticals: [], pricing_tier: 'STANDARD',
          settlement_speed: 'T1', is_active: true, notes: ''
        })}>+ Add Bank</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Bank</th><th>Tier</th><th>Entity</th><th>Currencies</th>
              <th>Networks</th><th>Max Risk</th><th>Pricing</th><th>Speed</th>
              <th>Indiv.</th><th>Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.bank_id}>
                <td><strong>{b.bank_name}</strong></td>
                <td><span className={`badge tier-${b.tier}`}>{b.tier}</span></td>
                <td className="mono">{b.sdm_entity}</td>
                <td className="mono">{(b.supported_currencies || []).join(', ')}</td>
                <td className="mono">{(b.settlement_networks || []).join(', ')}</td>
                <td><span className={`badge risk-${b.max_client_risk}`}>{b.max_client_risk}</span></td>
                <td className="mono">{b.pricing_tier}</td>
                <td className="mono">{b.settlement_speed}</td>
                <td>{b.accepts_individuals ? 'YES' : 'NO'}</td>
                <td>{b.is_active ? '●' : '○'}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn small" onClick={() => setEditing({ ...b })}>Edit</button>
                    <button className="btn small danger" onClick={() => setToDelete(b)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 30 }}>
                {q ? 'No banks match the search.' : 'No banks yet. Click + Add Bank to create one.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.bank_id ? `Edit ${editing.bank_name}` : 'Add Bank'}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn primary" onClick={save}>Save</button>
          </>}>
          <BankEditor value={editing} onChange={setEditing} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.bank_name}?`}
        body="This cannot be undone. Existing routing assignments referencing this bank will be preserved but new routing will exclude it."
        confirmLabel="Delete bank"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
