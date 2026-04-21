import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal.jsx';
import ClientForm from '../../components/ClientForm.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SearchBox from '../../components/SearchBox.jsx';
import { listClients, upsertClient, deleteClient } from '../../lib/dataStore.js';
import { useDataChange } from '../../lib/dataEvents.js';

export default function ClientsPage() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  async function load() {
    try { setRows(await listClients()); setErr(null); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('clients', load);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(c =>
      c.client_name?.toLowerCase().includes(s) ||
      c.business_vertical?.toLowerCase().includes(s) ||
      c.jurisdiction_country?.toLowerCase().includes(s) ||
      c.risk_rating?.toLowerCase().includes(s) ||
      (c.settlement_currencies || []).join(',').toLowerCase().includes(s)
    );
  }, [rows, q]);

  async function save() {
    try { await upsertClient(editing); setEditing(null); }
    catch (e) { setErr(e.message); }
  }
  async function remove() {
    if (!toDelete) return;
    try { await deleteClient(toDelete.client_id); setToDelete(null); }
    catch (e) { setErr(e.message); setToDelete(null); }
  }

  return (
    <>
      <h1 className="page-title">Clients</h1>
      <p className="page-sub">Client registry. {rows.length} total.</p>
      {err && <div className="error-banner">{err}</div>}

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search clients, vertical, country…" />
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing({
          client_name: '', entity_type: 'CORPORATION', business_vertical: '',
          jurisdiction_country: '', sdm_entity: 'SDM_INC', risk_rating: 'LOW',
          currencies_traded: [], settlement_currencies: [], settlement_methods: [],
          settlement_speed_sla: 'T1_NEXT_DAY', beneficiary_country: '',
          uses_stablecoins: false, priority_tier: 'P2', is_active: true
        })}>+ Add Client</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Client</th><th>Entity</th><th>Vertical</th><th>Jurisdiction</th>
              <th>Risk</th><th>Priority</th><th>Currencies</th><th>SLA</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.client_id}>
                <td><strong>{c.client_name}</strong></td>
                <td className="mono">{c.entity_type}</td>
                <td className="mono">{c.business_vertical}</td>
                <td className="mono">{c.jurisdiction_country}</td>
                <td><span className={`badge risk-${c.risk_rating}`}>{c.risk_rating}</span></td>
                <td><span className={`badge p-${c.priority_tier}`}>{c.priority_tier}</span></td>
                <td className="mono">{(c.settlement_currencies || []).join(', ')}</td>
                <td className="mono">{c.settlement_speed_sla}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn small" title="Route this client"
                      onClick={() => navigate(`/routing?client=${c.client_id}`)}>
                      ↗ Route
                    </button>
                    <button className="btn small" onClick={() => setEditing({ ...c })}>Edit</button>
                    <button className="btn small danger" onClick={() => setToDelete(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 30 }}>
                {q ? 'No clients match the search.' : 'No clients yet. Click + Add Client to create one.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.client_id ? `Edit ${editing.client_name}` : 'Add Client'}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn primary" onClick={save}>Save</button>
          </>}>
          <ClientForm value={editing} onChange={setEditing} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.client_name}?`}
        body="This cannot be undone. The client's routing history will be preserved."
        confirmLabel="Delete client"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
