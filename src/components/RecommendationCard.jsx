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

  // Snapshot the engine's primary recommendation in the alternative-shape so
  // we can put it back in the alternatives list when the user swaps.
  const enginePrimary = rec.recommended_bank ? {
    bank_id: rec.recommended_bank.bank_id,
    bank_name: rec.recommended_bank.bank_name,
    tier: rec.recommended_bank.tier,
    pricing_tier: rec.recommended_bank.pricing_tier,
    settlement_speed: rec.recommended_bank.settlement_speed,
    network: rec.settlement_network,
    feedstock_currency: rec.feedstock_currency,
    fx_needed: rec.fx_needed,
    recommended_lps: rec.recommended_lps || [],
    lp_gap_reason: rec.lp_gap_reason,
    bank: rec.recommended_bank,
    score: rec.score,
    match_pct: 100
  } : null;

  // Swap state: when non-null, this alternative is displayed as primary.
  const [swappedTo, setSwappedTo] = useState(null);
  useEffect(() => {
    // Reset swap whenever the leg itself changes (different client loaded)
    setSwappedTo(null);
  }, [rec.currency_leg, rec.recommended_bank?.bank_id]);

  // Resolve the active primary for display
  const active = swappedTo ?? enginePrimary;

  // Alternatives list = original alts minus the currently-active one + the
  // engine's primary if we've swapped away from it
  const allAlts = rec.alternatives || [];
  const displayAlts = swappedTo
    ? [
        enginePrimary,
        ...allAlts.filter(a => a.bank_id !== swappedTo.bank_id)
      ].filter(Boolean)
    : allAlts;

  const lps = active?.recommended_lps || [];

  // Local state: which LP is the "active" pick within the active bank.
  const [selectedLp, setSelectedLp] = useState(lps[0] || null);
  useEffect(() => {
    setSelectedLp(lps[0] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.bank_id, lps.map(l => l.lp_id).join(',')]);

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

      {active ? (
        <>
          <div className="bank-name">
            {active.bank_name}
            {swappedTo && (
              <span className="swapped-chip" title="Manually swapped from the engine's pick">
                swapped
              </span>
            )}
          </div>
          <div className="meta-row">
            <span className={`badge tier-${active.tier}`}>{active.tier}</span>
            {active.network && (
              <span className="badge network">{active.network}</span>
            )}
            <span className="badge">{active.pricing_tier}</span>
            <span className="badge">{active.settlement_speed}</span>
            {swappedTo && (
              <button className="btn small ghost reset-swap"
                onClick={() => setSwappedTo(null)}
                title="Restore the engine's recommended bank">
                ↺ Reset
              </button>
            )}
          </div>

          {/* Settlement flow — shows the bank acting as pass-through vs. doing FX */}
          <div className="section-label">Settlement Flow</div>
          <div className="flow-chain">
            {lps.length > 0 ? (
              <LPFlowPicker
                lps={lps}
                selected={selectedLp}
                onSelect={setSelectedLp}
                feedstock={active.feedstock_currency}
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
            <div className={`flow-step flow-bank ${active.fx_needed ? 'fx' : ''}`}>
              <div className="flow-step-label">{active.bank_name}</div>
              <div className="flow-step-value mono">
                {active.fx_needed
                  ? `FX: ${active.feedstock_currency} → ${rec.currency_leg}`
                  : 'passthrough'}
              </div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step flow-client">
              <div className="flow-step-label">Client</div>
              <div className="flow-step-value mono">{rec.currency_leg}</div>
            </div>
          </div>

          {displayAlts.length > 0 && (
            <>
              <div className="section-label">Alternative Banks</div>
              <ul className="alt-list">
                {displayAlts.map(alt => (
                  <li key={alt.bank_id} className="alt-row">
                    <div className="alt-left">
                      <div className="alt-name">{alt.bank_name}</div>
                      <div className="alt-meta mono">
                        {alt.tier}
                        {alt.network && <> · {alt.network}</>}
                        {alt.pricing_tier && <> · {alt.pricing_tier}</>}
                      </div>
                    </div>
                    <button
                      className="alt-swap-btn"
                      onClick={() => setSwappedTo(alt.bank_id === enginePrimary?.bank_id ? null : alt)}
                      title={`Swap to ${alt.bank_name}`}
                    >
                      ⇌ Swap
                    </button>
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
