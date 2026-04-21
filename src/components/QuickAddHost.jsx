import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import BankEditor from './BankEditor.jsx';
import LPEditor from './LPEditor.jsx';
import ClientForm from './ClientForm.jsx';
import AffinityEditor from './AffinityEditor.jsx';
import { useQuickAdd } from '../lib/quickAddContext.jsx';
import {
  upsertBank, upsertLP, upsertClient, upsertAffinity, listBanks
} from '../lib/dataStore.js';

const BLANKS = {
  bank: {
    bank_name: '', tier: 'T2', sdm_entity: 'SDM_INC',
    supported_currencies: [], settlement_networks: [],
    max_client_risk: 'MEDIUM', accepts_individuals: true,
    blocked_verticals: [], pricing_tier: 'STANDARD',
    settlement_speed: 'T1', is_active: true, notes: ''
  },
  lp: {
    lp_name: '', supported_currencies: [], settlement_networks: [],
    preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true, notes: ''
  },
  client: {
    client_name: '', entity_type: 'CORPORATION', business_vertical: '',
    jurisdiction_country: '', sdm_entity: 'SDM_INC', risk_rating: 'LOW',
    currencies_traded: [], settlement_currencies: [], settlement_methods: [],
    settlement_speed_sla: 'T1_NEXT_DAY', beneficiary_country: '',
    uses_stablecoins: false, priority_tier: 'P2', is_active: true
  },
  affinity: {
    label: '', currency: '', beneficiary_country: null, requires_stables_in: null,
    required_sdm_entity: null, required_risk: null, bank_id: '',
    boost: 100, sort_order: 100, is_active: true, rationale: ''
  }
};

const TITLES = {
  bank:     { add: 'Add Bank',          edit: 'Edit Bank' },
  lp:       { add: 'Add LP',            edit: 'Edit LP' },
  client:   { add: 'Add Client',        edit: 'Edit Client' },
  affinity: { add: 'Add Affinity Rule', edit: 'Edit Affinity Rule' }
};

// Global modal host — renders a single modal based on QuickAdd context state.
// Any page in the app can call openQuickAdd({ kind, record }) to pop this.
export default function QuickAddHost() {
  const { current, closeQuickAdd } = useQuickAdd();
  const [draft, setDraft] = useState(null);
  const [banks, setBanks] = useState([]);
  const [err, setErr] = useState(null);

  // Reset draft whenever a new open request arrives
  useEffect(() => {
    if (!current) { setDraft(null); setErr(null); return; }
    const base = current.record ? { ...current.record } : { ...BLANKS[current.kind] };
    setDraft(base);
    setErr(null);
    // Affinity editor needs bank list to populate its dropdown
    if (current.kind === 'affinity' || current.kind === 'lp') {
      listBanks().then(setBanks).catch(() => {});
    }
  }, [current]);

  if (!current || !draft) return null;

  const { kind } = current;
  const isEdit = Boolean(current.record);
  const title = TITLES[kind][isEdit ? 'edit' : 'add'];

  async function save() {
    try {
      if (kind === 'bank')      await upsertBank(draft);
      if (kind === 'lp')        await upsertLP(draft);
      if (kind === 'client')    await upsertClient(draft);
      if (kind === 'affinity')  await upsertAffinity(draft);
      // dataStore emits on every mutation — subscribers refresh automatically
      closeQuickAdd();
    } catch (e) { setErr(e.message ?? String(e)); }
  }

  return (
    <Modal title={title} onClose={closeQuickAdd}
      footer={<>
        <button className="btn ghost" onClick={closeQuickAdd}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </>}>
      {err && <div className="error-banner">{err}</div>}
      {kind === 'bank'     && <BankEditor value={draft} onChange={setDraft} />}
      {kind === 'lp'       && <LPEditor   value={draft} onChange={setDraft} banks={banks} />}
      {kind === 'client'   && <ClientForm value={draft} onChange={setDraft} />}
      {kind === 'affinity' && <AffinityEditor value={draft} onChange={setDraft} banks={banks} />}
    </Modal>
  );
}
