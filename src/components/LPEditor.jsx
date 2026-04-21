import { RISK_RATINGS, SETTLEMENT_NETWORKS } from '../engine/constants.js';

const ALL_CCYS = ['USD','EUR','GBP','CAD','AED','CNY','CHF','JPY','SGD','HKD','AUD','USDT','USDC','BTC','ETH'];

export default function LPEditor({ value, onChange, banks = [] }) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  const toggle = (field, item) => {
    const cur = new Set(v[field] || []);
    if (cur.has(item)) cur.delete(item); else cur.add(item);
    set({ [field]: [...cur] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field-grid">
        <label className="field">
          LP Name
          <input type="text" value={v.lp_name || ''}
            onChange={e => set({ lp_name: e.target.value })} />
        </label>
        <label className="field">
          Risk Tolerance
          <select value={v.risk_tolerance || 'MEDIUM'} onChange={e => set({ risk_tolerance: e.target.value })}>
            {RISK_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
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
        Supported Currencies
        <div className="checkbox-grid">
          {ALL_CCYS.map(c => (
            <label key={c} className={v.supported_currencies?.includes(c) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.supported_currencies?.includes(c)}
                onChange={() => toggle('supported_currencies', c)} />
              {c}
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Settlement Networks
        <div className="checkbox-grid">
          {SETTLEMENT_NETWORKS.map(n => (
            <label key={n} className={v.settlement_networks?.includes(n) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.settlement_networks?.includes(n)}
                onChange={() => toggle('settlement_networks', n)} />
              {n}
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Preferred Banks (optional — empty = all)
        <div className="checkbox-grid">
          {banks.map(b => (
            <label key={b.bank_id} className={v.preferred_banks?.includes(b.bank_id) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.preferred_banks?.includes(b.bank_id)}
                onChange={() => toggle('preferred_banks', b.bank_id)} />
              {b.bank_name}
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Notes
        <textarea value={v.notes || ''} onChange={e => set({ notes: e.target.value })} />
      </label>
    </div>
  );
}
