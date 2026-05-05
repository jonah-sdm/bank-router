import { useEffect, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { getWeights, updateWeights } from '../../lib/dataStore.js';
import { useDataChange } from '../../lib/dataEvents.js';
import { DEFAULT_FACTORS } from '../../engine/constants.js';

// Weights admin — renders dynamically from the factor list on the row.
// Adding a new factor (in DEFAULT_FACTORS) makes it appear here automatically;
// the engine reads whatever factors[] the row has, falling back to defaults
// for missing ones.
export default function WeightsPage() {
  const [row, setRow] = useState(null);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function load() {
    try { setRow(await getWeights()); setErr(null); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);
  useDataChange('weights', load);

  // Always read/write from row.weights.factors (the new shape)
  const factors = row?.weights?.factors ?? DEFAULT_FACTORS;
  const sum = factors.reduce((s, f) => s + (Number(f.weight) || 0), 0);

  function setFactorWeight(id, weight) {
    const next = factors.map(f =>
      f.id === id ? { ...f, weight: parseInt(weight, 10) || 0 } : f
    );
    setRow({ ...row, weights: { ...(row?.weights ?? {}), factors: next } });
  }

  async function save() {
    try {
      await updateWeights({ factors });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setErr(e.message); }
  }

  function doReset() {
    setRow({ ...row, weights: { factors: DEFAULT_FACTORS.map(f => ({ ...f })) } });
    setConfirmReset(false);
  }

  return (
    <>
      <h1 className="page-title">Scoring Weights</h1>
      <p className="page-sub">
        Tune how the routing engine ranks eligible banks. Per Curtis/Jim:
        Network Bonus is the dominant factor — intra-system rails (Blink / Cubix
        / Ripple ODL) settle instantly and free with our LPs and should win whenever both sides are on the same network.
      </p>
      {err && <div className="error-banner">{err}</div>}
      {saved && <div className="info-banner">Saved. Routing recommendations now use these weights.</div>}

      {!row ? <div className="empty-state">Loading…</div> : (
        <div className="card">
          <div className="card-header">
            <h3>Factors</h3>
            <span className="hint">
              Sum: {sum} — auto-normalized at routing time. Order = priority.
            </span>
          </div>

          {factors.map((factor, idx) => (
            <div key={factor.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, gap: 12 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-faint)',
                    marginRight: 8,
                    width: 18,
                    textAlign: 'right'
                  }}>#{idx + 1}</span>
                  <strong>{factor.label}</strong>
                  {factor.description && (
                    <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 6 }}>
                      — {factor.description}
                    </span>
                  )}
                </span>
                <span className="mono" style={{ color: 'var(--amber)', fontWeight: 700, flexShrink: 0 }}>
                  {factor.weight}
                </span>
              </div>
              <input type="range" min={0} max={100} value={factor.weight}
                onChange={e => setFactorWeight(factor.id, e.target.value)}
                style={{ width: '100%' }} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn primary" onClick={save}>Save Weights</button>
            <button className="btn" onClick={() => setConfirmReset(true)}>Reset to Defaults</button>
          </div>

          <div style={{
            marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-soft)',
            fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.55
          }}>
            <strong style={{ color: 'var(--text-dim)' }}>Extensible:</strong>
            {' '}new factors can be added in <code>src/engine/constants.js</code> (DEFAULT_FACTORS).
            They will appear here automatically, and the engine picks them up
            once a corresponding scoring rule is wired in <code>scoreBanks()</code>.
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset scoring weights to defaults?"
        body="This restores the post-product-call defaults: Network Bonus 50, Tier 30, Speed 25, Pricing 20, Priority 10. Click Save afterward to commit."
        confirmLabel="Reset"
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
}
