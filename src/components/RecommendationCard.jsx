import { useEffect, useState } from 'react';
import Tooltip, { BANK_TIER_DESCRIPTIONS } from './Tooltip.jsx';
import SettlementFlowSection from './SettlementFlowSection.jsx';

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
          <div className="bank-name">{active.bank_name}</div>
          <div className="meta-row">
            <Tooltip content={BANK_TIER_DESCRIPTIONS[active.tier] || active.tier}>
              <span className={`badge tier-${active.tier}`}>{active.tier}</span>
            </Tooltip>
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

          {/* Settlement Flow — buy/sell toggle + 5/6-step chain */}
          <SettlementFlowSection
            settlementFlow={active.settlement_flow ?? rec.settlement_flow}
            bridgeFlow={rec.bridge_flow}
            currency={rec.currency_leg}
            lps={lps}
            selectedLp={selectedLp}
            onSelectLp={setSelectedLp}
            fallbackBankName={active.bank_name}
            fallbackFeedstock={active.feedstock_currency}
            fallbackFxNeeded={active.fx_needed}
          />

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
