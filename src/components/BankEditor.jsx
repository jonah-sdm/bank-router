import { useState } from 'react';
import {
  BANK_TIERS, SDM_ENTITIES, RISK_RATINGS, PRICING_TIERS,
  SETTLEMENT_SPEED, CLIENT_REQUESTABLE_NETWORKS, PROPRIETARY_NETWORKS,
  PROPRIETARY_UPGRADES, BUSINESS_VERTICALS
} from '../engine/constants.js';

const ALL_CCYS = ['USD','EUR','GBP','CAD','AED','CNY','CHF','JPY','SGD','HKD','AUD'];

export default function BankEditor({ value, onChange }) {
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
          Bank Name
          <input type="text" value={v.bank_name || ''}
            onChange={e => set({ bank_name: e.target.value })} />
        </label>
        <label className="field">
          Tier
          <select value={v.tier || 'T2'} onChange={e => set({ tier: e.target.value })}>
            {BANK_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">
          SDM Entity
          <select value={v.sdm_entity || 'SDM_INC'} onChange={e => set({ sdm_entity: e.target.value })}>
            {SDM_ENTITIES.concat(['BOTH']).map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label className="field">
          Max Client Risk
          <select value={v.max_client_risk || 'MEDIUM'} onChange={e => set({ max_client_risk: e.target.value })}>
            {RISK_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">
          Pricing Tier
          <select value={v.pricing_tier || 'STANDARD'} onChange={e => set({ pricing_tier: e.target.value })}>
            {PRICING_TIERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          Settlement Speed
          <select value={v.settlement_speed || 'T1'} onChange={e => set({ settlement_speed: e.target.value })}>
            {SETTLEMENT_SPEED.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          Accepts Individuals
          <div className="radio-row">
            <label className={v.accepts_individuals === true ? 'selected' : ''}>
              <input type="radio" checked={v.accepts_individuals === true}
                onChange={() => set({ accepts_individuals: true })} />YES
            </label>
            <label className={v.accepts_individuals === false ? 'selected' : ''}>
              <input type="radio" checked={v.accepts_individuals === false}
                onChange={() => set({ accepts_individuals: false })} />NO
            </label>
          </div>
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
        Supported Currencies (payouts to clients)
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          What currencies this bank can wire out to the client.
        </div>
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
        Accepts LP Feedstock
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          Currencies this bank accepts as input from an LP (the bank does any FX
          conversion to the final payout currency). For Ripple ODL: USDT / USDC only.
          For USD-domestic banks: USD. For FX banks: USD plus major currencies.
        </div>
        <div className="checkbox-grid">
          {[...ALL_CCYS, 'USDT', 'USDC'].map(c => (
            <label key={c} className={v.accepts_lp_currencies?.includes(c) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.accepts_lp_currencies?.includes(c)}
                onChange={() => toggle('accepts_lp_currencies', c)} />
              {c}
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Industry Rails
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          Public rails clients can explicitly request. Pick the ones this bank can originate or receive.
        </div>
        <div className="checkbox-grid">
          {CLIENT_REQUESTABLE_NETWORKS.map(n => (
            <label key={n} className={v.settlement_networks?.includes(n) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.settlement_networks?.includes(n)}
                onChange={() => toggle('settlement_networks', n)} />
              {n}
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Proprietary / Instant Network
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginBottom: 4 }}>
          Bank-owned instant rails. Engine auto-upgrades to these when a client requests the equivalent industry rail.
        </div>
        <div className="checkbox-grid">
          {PROPRIETARY_NETWORKS.map(n => (
            <label key={n} className={v.settlement_networks?.includes(n) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.settlement_networks?.includes(n)}
                onChange={() => toggle('settlement_networks', n)} />
              {n} <span style={{ opacity: 0.6, fontSize: 10 }}>
                (upgrades {PROPRIETARY_UPGRADES[n]})
              </span>
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Blocked Verticals
        <div className="checkbox-grid">
          {BUSINESS_VERTICALS.map(bv => (
            <label key={bv.code} className={v.blocked_verticals?.includes(bv.code) ? 'checked' : ''}>
              <input type="checkbox" checked={!!v.blocked_verticals?.includes(bv.code)}
                onChange={() => toggle('blocked_verticals', bv.code)} />
              {bv.code}
            </label>
          ))}
        </div>
      </label>

      <label className="field">
        Notes
        <textarea value={v.notes || ''}
          onChange={e => set({ notes: e.target.value })} />
      </label>
    </div>
  );
}
