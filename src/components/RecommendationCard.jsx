import { useEffect, useRef, useState } from 'react';

// Human-readable explanation of why an LP set is empty.
// Differentiates registry gaps ("no LP supports CNY") from routing quirks
// ("the engine auto-picked SWIFT and no LP does SWIFT-to-Equals").
function renderLPGap(rec) {
  const ccy = rec.currency_leg;
  const net = rec.settlement_network;
  const bank = rec.recommended_bank?.bank_name;
  const autoPicked = rec.network_auto_selected;

  const accepted = rec.recommended_bank?.accepts_lp_currencies || rec.recommended_bank?.supported_currencies || [];
  const acceptedStr = accepted.length ? accepted.join(', ') : '—';

  switch (rec.lp_gap_reason) {
    case 'NO_LP_FOR_BANK_FEEDSTOCK':
      return (
        <>
          <strong style={{ color: 'var(--yellow)' }}>LP registry gap:</strong>{' '}
          <strong>{bank}</strong> accepts liquidity in <span className="mono">{acceptedStr}</span>,
          but no LP in the registry provides any of those.
          <div style={{ marginTop: 4, color: 'var(--text-faint)' }}>
            Add an LP that supplies one of those currencies in <em>Registry → LPs</em>
            (coordinate with the trading desk).
          </div>
        </>
      );
    case 'NO_LP_FOR_CURRENCY':
      return (
        <>
          <strong style={{ color: 'var(--yellow)' }}>LP registry gap:</strong>{' '}
          no liquidity provider in the registry supports {ccy}.
          <div style={{ marginTop: 4, color: 'var(--text-faint)' }}>
            Add an LP for {ccy} in <em>Registry → LPs</em> (coordinate with the trading desk).
          </div>
        </>
      );
    case 'NO_LP_FOR_NETWORK':
      return (
        <>
          LPs exist for {ccy}, but none settle via <span className="mono">{net}</span>
          {autoPicked && <> (which the engine auto-selected because you didn't specify a method)</>}
          {!autoPicked && <> (which you requested)</>}.
          <div style={{ marginTop: 4, color: 'var(--text-faint)' }}>
            Either change the settlement method, or add an LP that supports {ccy} + {net}.
          </div>
        </>
      );
    case 'NO_LP_FOR_BANK':
      return (
        <>
          LPs exist for {ccy} on <span className="mono">{net}</span>, but none list{' '}
          <strong>{bank}</strong> in their preferred-banks whitelist.
          <div style={{ marginTop: 4, color: 'var(--text-faint)' }}>
            Edit an LP in <em>Registry → LPs</em> and add this bank to its preferred banks.
          </div>
        </>
      );
    case 'EMPTY_REGISTRY':
      return 'LP registry is empty. Add at least one LP to get recommendations.';
    case 'NO_BANK_OR_NETWORK':
      return 'No bank or network resolved — upstream engine failure.';
    default:
      return `No LPs match ${net} for ${ccy}. Manual LP selection required.`;
  }
}

// Inline LP picker used inside the Settlement Flow. Clickable box that opens a
// popover listing all recommended LPs for this leg. Lets ops choose which LP
// to actually use — default is the first (engine-picked) LP.
function LPFlowPicker({ lps, selected, onSelect, feedstock }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const multi = lps.length > 1;

  return (
    <div
      ref={ref}
      className={`flow-step flow-lp ${multi ? 'has-dropdown' : ''} ${open ? 'open' : ''}`}
      onClick={() => multi && setOpen(v => !v)}
      role={multi ? 'button' : undefined}
      tabIndex={multi ? 0 : undefined}
      onKeyDown={(e) => { if (multi && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(v => !v); } }}
    >
      <div className="flow-step-label">
        {selected?.lp_name || 'LP'}
        {multi && <span className="flow-step-chev">{open ? '▴' : '▾'}</span>}
      </div>
      <div className="flow-step-value mono">{feedstock || '—'}</div>

      {open && (
        <div className="flow-lp-menu" onClick={e => e.stopPropagation()} role="listbox">
          <div className="flow-lp-menu-label">Choose liquidity provider</div>
          {lps.map(lp => (
            <div
              key={lp.lp_id}
              role="option"
              aria-selected={lp.lp_id === selected?.lp_id}
              className={`flow-lp-menu-item ${lp.lp_id === selected?.lp_id ? 'selected' : ''}`}
              onClick={() => { onSelect(lp); setOpen(false); }}
            >
              <span className="flow-lp-menu-name">{lp.lp_name}</span>
              <span className="flow-lp-menu-meta mono">
                {(lp.supported_currencies || []).slice(0, 4).join(', ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecommendationCard({ rec }) {
  const isOverride = rec.is_manual_override;
  const lps = rec.recommended_lps || [];

  // Local state: which LP is the "active" pick. Defaults to the engine's
  // first recommendation and resets whenever the LP list changes.
  const [selectedLp, setSelectedLp] = useState(lps[0] || null);
  useEffect(() => {
    setSelectedLp(lps[0] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.currency_leg, lps.map(l => l.lp_id).join(',')]);

  return (
    <div className={`rec-card ${isOverride ? 'override' : ''}`}>
      <div className="leg">
        <span className="ccy">{rec.currency_leg}</span>
        <span className="label">currency leg</span>
        {rec.manual_review_flag && (
          <span style={{ marginLeft: 'auto' }}>
            <span className="badge badge-review">MANUAL REVIEW</span>
          </span>
        )}
      </div>

      {rec.recommended_bank ? (
        <>
          <div className="bank-name">{rec.recommended_bank.bank_name}</div>
          <div className="meta-row">
            <span className={`badge tier-${rec.recommended_bank.tier}`}>{rec.recommended_bank.tier}</span>
            {rec.settlement_network && (
              <span className="badge network">{rec.settlement_network}</span>
            )}
            <span className="badge">{rec.recommended_bank.pricing_tier}</span>
            <span className="badge">{rec.recommended_bank.settlement_speed}</span>
          </div>

          {/* Settlement flow — shows the bank acting as pass-through vs. doing FX */}
          <div className="section-label">Settlement Flow</div>
          <div className="flow-chain">
            {lps.length > 0 ? (
              <LPFlowPicker
                lps={lps}
                selected={selectedLp}
                onSelect={setSelectedLp}
                feedstock={rec.feedstock_currency}
              />
            ) : (
              <div className="flow-step flow-lp flow-lp-empty">
                <div className="flow-step-label">LP</div>
                <div className="flow-step-value mono" style={{ color: 'var(--text-faint)' }}>
                  none available
                </div>
              </div>
            )}
            <div className="flow-arrow">→</div>
            <div className={`flow-step flow-bank ${rec.fx_needed ? 'fx' : ''}`}>
              <div className="flow-step-label">{rec.recommended_bank?.bank_name}</div>
              <div className="flow-step-value mono">
                {rec.fx_needed
                  ? `FX: ${rec.feedstock_currency} → ${rec.currency_leg}`
                  : 'passthrough'}
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step flow-client">
              <div className="flow-step-label">Client</div>
              <div className="flow-step-value mono">{rec.currency_leg}</div>
            </div>
          </div>

          {rec.alternatives?.length > 0 && (
            <>
              <div className="section-label">Alternative Banks</div>
              <ul className="alt-list">
                {rec.alternatives.map(alt => (
                  <li key={alt.bank_id} className="alt-row">
                    <div className="alt-left">
                      <div className="alt-name">{alt.bank_name}</div>
                      <div className="alt-meta mono">
                        {alt.tier}
                        {alt.network && <> · {alt.network}</>}
                        {alt.pricing_tier && <> · {alt.pricing_tier}</>}
                      </div>
                    </div>
                    <div className="alt-match">
                      <div className="alt-match-bar">
                        <div className="alt-match-fill" style={{ width: `${alt.match_pct}%` }} />
                      </div>
                      <div className={`alt-match-pct match-${alt.match_pct}`}>{alt.match_pct}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {lps.length === 0 && (
            <>
              <div className="section-label">LP Status</div>
              <div style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.55 }}>
                {renderLPGap(rec)}
              </div>
            </>
          )}

        </>
      ) : (
        <div style={{ padding: '24px 0', color: 'var(--red)' }}>
          No eligible bank found for {rec.currency_leg}.
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>
            Try adjusting risk rating, business vertical, or settlement method on the profile.
          </div>
        </div>
      )}

    </div>
  );
}
