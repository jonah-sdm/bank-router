import { SDM_ENTITIES, RISK_RATINGS } from '../engine/constants.js';

const ALL_CCYS = ['USD','EUR','GBP','CAD','AED','CNY','CHF','JPY','SGD','HKD','AUD'];

export default function AffinityEditor({ value, onChange, banks = [] }) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label className="field">
        Label
        <input type="text" value={v.label || ''} placeholder="Human-readable, e.g. CNY → Equals"
          onChange={e => set({ label: e.target.value })} />
      </label>

      <div className="field-grid">
        <label className="field">
          Currency
          <select value={v.currency || ''} onChange={e => set({ currency: e.target.value })}>
            <option value="">— Required —</option>
            {ALL_CCYS.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="*">* (any)</option>
          </select>
        </label>

        <label className="field">
          Beneficiary Country (optional)
          <input type="text" maxLength={2} className="mono"
            placeholder="ISO-2 or blank for any"
            value={v.beneficiary_country || ''}
            onChange={e => set({ beneficiary_country: e.target.value.toUpperCase() || null })} />
        </label>

        <label className="field">
          Requires Stables-in?
          <div className="radio-row">
            <label className={v.requires_stables_in === null || v.requires_stables_in === undefined ? 'selected' : ''}>
              <input type="radio" checked={v.requires_stables_in == null}
                onChange={() => set({ requires_stables_in: null })} />ANY
            </label>
            <label className={v.requires_stables_in === true ? 'selected' : ''}>
              <input type="radio" checked={v.requires_stables_in === true}
                onChange={() => set({ requires_stables_in: true })} />YES
            </label>
            <label className={v.requires_stables_in === false ? 'selected' : ''}>
              <input type="radio" checked={v.requires_stables_in === false}
                onChange={() => set({ requires_stables_in: false })} />NO
            </label>
          </div>
        </label>

        <label className="field">
          Required SDM Entity (optional)
          <select value={v.required_sdm_entity || ''}
            onChange={e => set({ required_sdm_entity: e.target.value || null })}>
            <option value="">ANY</option>
            {SDM_ENTITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="field">
          Required Risk (optional)
          <select value={v.required_risk || ''}
            onChange={e => set({ required_risk: e.target.value || null })}>
            <option value="">ANY</option>
            {RISK_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="field">
          Prefer Bank
          <select value={v.bank_id || ''} onChange={e => set({ bank_id: e.target.value })}>
            <option value="">— Required —</option>
            {banks.map(b => <option key={b.bank_id} value={b.bank_id}>{b.bank_name}</option>)}
          </select>
        </label>

        <label className="field">
          Boost ({v.boost ?? 100})
          <input type="range" min={-100} max={200} value={v.boost ?? 100}
            onChange={e => set({ boost: parseInt(e.target.value, 10) })} />
        </label>

        <label className="field">
          Sort Order
          <input type="number" value={v.sort_order ?? 100}
            onChange={e => set({ sort_order: parseInt(e.target.value, 10) || 100 })} />
        </label>

        <label className="field">
          Active
          <div className="radio-row">
            <label className={v.is_active !== false ? 'selected' : ''}>
              <input type="radio" checked={v.is_active !== false}
                onChange={() => set({ is_active: true })} />ACTIVE
            </label>
            <label className={v.is_active === false ? 'selected' : ''}>
              <input type="radio" checked={v.is_active === false}
                onChange={() => set({ is_active: false })} />INACTIVE
            </label>
          </div>
        </label>
      </div>

      <label className="field">
        Rationale
        <textarea placeholder="Why does this rule exist? Quote the transcript or ops decision."
          value={v.rationale || ''} onChange={e => set({ rationale: e.target.value })} />
      </label>
    </div>
  );
}
