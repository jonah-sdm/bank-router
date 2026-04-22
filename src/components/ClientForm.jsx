import {
  BUSINESS_VERTICALS, ENTITY_TYPES, RISK_RATINGS, SDM_ENTITIES,
  PRIORITY_TIERS, SETTLEMENT_SLA, CLIENT_REQUESTABLE_NETWORKS
} from '../engine/constants.js';
import CountryPicker from './CountryPicker.jsx';

const FIAT_CCYS   = ['USD','EUR','GBP','CAD','AED','CNY','CHF','JPY','SGD','HKD','AUD'];
const TRADE_CCYS  = [...FIAT_CCYS, 'USDT','USDC','BTC','ETH','SOL'];
// Client only picks industry-standard rails. Proprietary networks (CUBIX, BLINK,
// RIPPLE_ODL) live on the bank profile and are auto-selected by the engine.
const METHODS     = CLIENT_REQUESTABLE_NETWORKS;

// Flat client-profile form with two section sub-headers (Identity, Trading &
// Settlement). NOT a collapsible — the caller wraps this in whatever shell it
// needs (a collapsible card on the routing page, a modal body on the admin
// client-edit page).
export default function ClientForm({ value, onChange }) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });

  const toggleArray = (field, item) => {
    const cur = new Set(v[field] || []);
    const wasChecked = cur.has(item);
    if (wasChecked) cur.delete(item); else cur.add(item);
    const patch = { [field]: [...cur] };

    // Auto-sync: toggling a fiat currency in "Currencies Traded" mirrors the
    // change into "Settlement Currencies" so the routing engine picks it up.
    // Users can still un-check a settlement currency independently if they
    // want to trade it but not settle it through banking (rare).
    if (field === 'currencies_traded' && FIAT_CCYS.includes(item)) {
      const settled = new Set(v.settlement_currencies || []);
      if (wasChecked) settled.delete(item); else settled.add(item);
      patch.settlement_currencies = [...settled];
    }
    set(patch);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div>
        <div className="sub-section">Identity</div>
        <div className="field-grid">
          <label className="field">
            Client Name
            <input type="text" value={v.client_name || ''}
              onChange={e => set({ client_name: e.target.value })}
              placeholder="Legal entity name" />
          </label>
          <label className="field">
            SDM Entity
            <div className="radio-row">
              {SDM_ENTITIES.map(e => (
                <label key={e} className={v.sdm_entity === e ? 'selected' : ''}>
                  <input type="radio" name="sdm_entity" checked={v.sdm_entity === e}
                    onChange={() => set({ sdm_entity: e })} />
                  {e.replace('SDM_', '')}
                </label>
              ))}
            </div>
          </label>
          <label className="field">
            Entity Type
            <div className="radio-row">
              {ENTITY_TYPES.map(e => (
                <label key={e} className={v.entity_type === e ? 'selected' : ''}>
                  <input type="radio" name="entity_type" checked={v.entity_type === e}
                    onChange={() => set({ entity_type: e })} />
                  {e}
                </label>
              ))}
            </div>
          </label>
          <label className="field">
            Business Vertical
            <select value={v.business_vertical || ''}
              onChange={e => set({ business_vertical: e.target.value })}>
              <option value="">— Select —</option>
              {BUSINESS_VERTICALS.map(bv => (
                <option key={bv.code} value={bv.code}>{bv.code} — {bv.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Jurisdiction
            <CountryPicker
              value={v.jurisdiction_country}
              onChange={code => set({ jurisdiction_country: code })}
              placeholder="Type country name, UK, USA, etc."
            />
          </label>
          <label className="field">
            Risk Rating
            <div className="radio-row">
              {RISK_RATINGS.map(r => (
                <label key={r} className={v.risk_rating === r ? 'selected' : ''}>
                  <input type="radio" name="risk_rating" checked={v.risk_rating === r}
                    onChange={() => set({ risk_rating: r })} />
                  {r}
                </label>
              ))}
            </div>
          </label>
        </div>
      </div>

      <div>
        <div className="sub-section">Trading & Settlement</div>

        <label className="field" style={{ marginBottom: 14 }}>
          Currencies Traded
          <div className="checkbox-grid">
            {TRADE_CCYS.map(c => (
              <label key={c} className={v.currencies_traded?.includes(c) ? 'checked' : ''}>
                <input type="checkbox" checked={!!v.currencies_traded?.includes(c)}
                  onChange={() => toggleArray('currencies_traded', c)} />
                {c}
              </label>
            ))}
          </div>
        </label>

        <label className="field" style={{ marginBottom: 14 }}>
          Settlement Currencies (fiat)
          <div className="checkbox-grid">
            {FIAT_CCYS.map(c => (
              <label key={c} className={v.settlement_currencies?.includes(c) ? 'checked' : ''}>
                <input type="checkbox" checked={!!v.settlement_currencies?.includes(c)}
                  onChange={() => toggleArray('settlement_currencies', c)} />
                {c}
              </label>
            ))}
          </div>
        </label>

        <label className="field" style={{ marginBottom: 14 }}>
          Settlement Method Requested
          <div className="checkbox-grid">
            {METHODS.map(m => (
              <label key={m} className={v.settlement_methods?.includes(m) ? 'checked' : ''}>
                <input type="checkbox" checked={!!v.settlement_methods?.includes(m)}
                  onChange={() => toggleArray('settlement_methods', m)} />
                {m}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginTop: 4 }}>
            Industry rails only. If the routed bank offers an instant proprietary rail
            (CUBIX / BLINK / Ripple ODL) covering the same flow, the engine will upgrade
            to it automatically.
          </div>
        </label>

        <div className="field-grid">
          <label className="field">
            Settlement Speed SLA
            <div className="radio-row">
              {SETTLEMENT_SLA.map(s => (
                <label key={s} className={v.settlement_speed_sla === s ? 'selected' : ''}>
                  <input type="radio" name="speed" checked={v.settlement_speed_sla === s}
                    onChange={() => set({ settlement_speed_sla: s })} />
                  {s.replace('_', ' ').replace('SAME DAY', 'SAME').replace('NEXT DAY','NEXT').replace('TWO DAY','TWO')}
                </label>
              ))}
            </div>
          </label>
          <label className="field">
            Beneficiary Country
            <CountryPicker
              value={v.beneficiary_country}
              onChange={code => set({ beneficiary_country: code })}
              placeholder="Where funds land (for Ripple eligibility)"
            />
          </label>
          <label className="field">
            Uses Stablecoins
            <div className="radio-row">
              <label className={v.uses_stablecoins === true ? 'selected' : ''}>
                <input type="radio" checked={v.uses_stablecoins === true}
                  onChange={() => set({ uses_stablecoins: true })} />
                YES
              </label>
              <label className={v.uses_stablecoins === false ? 'selected' : ''}>
                <input type="radio" checked={v.uses_stablecoins === false}
                  onChange={() => set({ uses_stablecoins: false })} />
                NO
              </label>
            </div>
          </label>
          <label className="field">
            Priority Tier
            <div className="radio-row">
              {PRIORITY_TIERS.map(p => (
                <label key={p} className={v.priority_tier === p ? 'selected' : ''}>
                  <input type="radio" name="priority" checked={v.priority_tier === p}
                    onChange={() => set({ priority_tier: p })} />
                  {p}
                </label>
              ))}
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
