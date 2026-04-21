import { useEffect, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { getWeights, updateWeights } from '../../lib/dataStore.js';
import { useDataChange } from '../../lib/dataEvents.js';
import { DEFAULT_WEIGHTS } from '../../engine/constants.js';

const WEIGHTS_META = [
  ['tier_weight',             'Bank Tier',            'T1=100, T2=60, T3=30, Specialist=50'],
  ['settlement_speed_weight', 'Settlement Speed',     'Full 100 if bank speed matches client SLA'],
  ['pricing_weight',          'Pricing Tier',         'BEST=100, COMPETITIVE=80, STANDARD=50, PREMIUM=20'],
  ['network_bonus_weight',    'Network Bonus',        'BLINK / CUBIX / RIPPLE_ODL = instant/free = 100'],
  ['priority_bonus_weight',   'Priority Client Bonus','P1 client × INSTANT/SAME_DAY bank = 100']
];

export default function WeightsPage() {
  const [w, setW] = useState(null);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function load() {
    try { setW(await getWeights()); setErr(null); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('weights', load);

  async function save() {
    try { await updateWeights(w); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setErr(e.message); }
  }
  function doReset() {
    setW({ ...w, ...DEFAULT_WEIGHTS });
    setConfirmReset(false);
  }

  return (
    <>
      <h1 className="page-title">Scoring Weights</h1>
      <p className="page-sub">Tune how the routing engine balances tier, speed, pricing, network, and priority.</p>
      {err && <div className="error-banner">{err}</div>}
      {saved && <div className="info-banner">Saved. Routing recommendations now use these weights.</div>}

      {!w ? <div className="empty-state">Loading…</div> : (
        <div className="card">
          <div className="card-header">
            <h3>Weights</h3>
            <span className="hint">
              Sum: {w.tier_weight + w.settlement_speed_weight + w.pricing_weight + w.network_bonus_weight + w.priority_bonus_weight} — auto-normalized at routing time
            </span>
          </div>

          {WEIGHTS_META.map(([key, label, hint]) => (
            <div key={key} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span><strong>{label}</strong> <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>— {hint}</span></span>
                <span className="mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>{w[key]}%</span>
              </div>
              <input type="range" min={0} max={100} value={w[key]}
                onChange={e => setW({ ...w, [key]: parseInt(e.target.value, 10) })}
                style={{ width: '100%' }} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn primary" onClick={save}>Save Weights</button>
            <button className="btn" onClick={() => setConfirmReset(true)}>Reset to PRD Defaults</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset scoring weights to PRD defaults?"
        body="This will overwrite the current weights with Tier 30 / Speed 25 / Pricing 20 / Network 15 / Priority 10. You can still click Save or navigate away to discard."
        confirmLabel="Reset"
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
