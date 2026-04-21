import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import AffinityEditor from '../../components/AffinityEditor.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SearchBox from '../../components/SearchBox.jsx';
import { listAffinity, upsertAffinity, deleteAffinity, listBanks } from '../../lib/dataStore.js';
import { useDataChange } from '../../lib/dataEvents.js';

export default function AffinityPage() {
  const [rows, setRows] = useState([]);
  const [banks, setBanks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [filterCcy, setFilterCcy] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);

  async function load() {
    try {
      const [rules, bks] = await Promise.all([listAffinity(), listBanks()]);
      setRows(rules); setBanks(bks); setErr(null);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('affinity', load);
  useDataChange('banks', load);

  const currencies = useMemo(() => [...new Set(rows.map(r => r.currency))].sort(), [rows]);

  const shown = useMemo(() => {
    let r = filterCcy ? rows.filter(x => x.currency === filterCcy) : rows;
    if (q) {
      const s = q.toLowerCase();
      r = r.filter(x =>
        x.label?.toLowerCase().includes(s) ||
        x.currency?.toLowerCase().includes(s) ||
        x.beneficiary_country?.toLowerCase().includes(s) ||
        banks.find(b => b.bank_id === x.bank_id)?.bank_name.toLowerCase().includes(s) ||
        x.rationale?.toLowerCase().includes(s)
      );
    }
    return r;
  }, [rows, filterCcy, q, banks]);

  async function save() {
    try { await upsertAffinity(editing); setEditing(null); }
    catch (e) { setErr(e.message); }
  }
  async function remove() {
    if (!toDelete) return;
    try { await deleteAffinity(toDelete.rule_id); setToDelete(null); }
    catch (e) { setErr(e.message); setToDelete(null); }
  }

  return (
    <>
      <h1 className="page-title">Affinity Rules</h1>
      <p className="page-sub">
        Preferred-bank-per-context map. Each rule adds a boost to the base score.
        Seeded from the Curtis + Jonah transcript. {rows.length} total.
      </p>
      {err && <div className="error-banner">{err}</div>}

      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search rules, bank, rationale…" />
        <select value={filterCcy} onChange={e => setFilterCcy(e.target.value)}>
          <option value="">All currencies ({rows.length})</option>
          {currencies.map(c => <option key={c} value={c}>{c} ({rows.filter(r => r.currency === c).length})</option>)}
        </select>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing({
          label: '', currency: '', beneficiary_country: null, requires_stables_in: null,
          required_sdm_entity: null, required_risk: null, bank_id: '',
          boost: 100, sort_order: 100, is_active: true, rationale: ''
        })}>+ Add Rule</button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Label</th><th>Ccy</th><th>Country</th><th>Stables</th>
              <th>Entity</th><th>Risk</th><th>Prefer Bank</th><th>Boost</th><th>Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const bankName = banks.find(b => b.bank_id === r.bank_id)?.bank_name ?? '—';
              return (
                <tr key={r.rule_id}>
                  <td><strong>{r.label}</strong>
                    {r.rationale && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{r.rationale}</div>}
                  </td>
                  <td className="mono">{r.currency}</td>
                  <td className="mono">{r.beneficiary_country || '—'}</td>
                  <td className="mono">{r.requires_stables_in == null ? 'any' : (r.requires_stables_in ? 'yes' : 'no')}</td>
                  <td className="mono">{r.required_sdm_entity || '—'}</td>
                  <td className="mono">{r.required_risk ? <span className={`badge risk-${r.required_risk}`}>{r.required_risk}</span> : '—'}</td>
                  <td><strong>{bankName}</strong></td>
                  <td className="mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>+{r.boost}</td>
                  <td>{r.is_active ? '●' : '○'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn small" onClick={() => setEditing({ ...r })}>Edit</button>
                      <button className="btn small danger" onClick={() => setToDelete(r)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 30 }}>
                {q || filterCcy ? 'No rules match the filter.' : 'No rules. Click + Add Rule to create one.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.rule_id ? `Edit ${editing.label || 'rule'}` : 'Add Affinity Rule'}
          onClose={() => setEditing(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn primary" onClick={save}>Save</button>
          </>}>
          <AffinityEditor value={editing} onChange={setEditing} banks={banks} />
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete "${toDelete?.label || 'rule'}"?`}
        body="This affinity rule will no longer apply to future routing recommendations."
        confirmLabel="Delete rule"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
