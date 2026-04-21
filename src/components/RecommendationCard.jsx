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
      // Retained for back-compat; current engine emits NO_LP_FOR_BANK_FEEDSTOCK.
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
  return (
    <div className={`rec-card ${isOverride ? 'override' : ''}`}>
      <div className="leg">
        <span className="ccy">{rec.currency_leg}</span>
        <span className="label">currency leg</span>
        <span style={{ marginLeft: 'auto' }}>
          <span className={`badge conf-${rec.confidence}`}>{rec.confidence} confidence</span>
        </span>
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
            <div className="flow-step flow-lp">
              <div className="flow-step-label">
                {rec.recommended_lps?.[0]?.lp_name || 'LP'}
                {rec.recommended_lps?.length > 1 && (
                  <span className="flow-step-extra"> +{rec.recommended_lps.length - 1}</span>
                )}
              </div>
              <div className="flow-step-value mono">{rec.feedstock_currency || '—'}</div>
            </div>
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

          {rec.fallback_bank && (
            <>
              <div className="section-label">Fallback</div>
              <div style={{ fontSize: 13 }}>
                {rec.fallback_bank.bank_name}
                {' · '}
                <span className="mono" style={{ color: 'var(--text-dim)' }}>{rec.fallback_bank.tier}</span>
              </div>
            </>
          )}

          {rec.recommended_lps?.length > 0 && (
            <>
              <div className="section-label">Recommended LPs</div>
              <div>
                {rec.recommended_lps.map(lp => (
                  <span key={lp.lp_id} className="lp-chip">{lp.lp_name}</span>
                ))}
              </div>
            </>
          )}

          {rec.recommended_lps?.length === 0 && (
            <>
              <div className="section-label">Recommended LPs</div>
              <div style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.55 }}>
                {renderLPGap(rec)}
              </div>
            </>
          )}

          <details className="exclusion-accordion">
            <summary>Exclusion log ({rec.exclusion_log?.length ?? 0})</summary>
            <ul className="exclusion-list">
              {rec.exclusion_log.map((x, i) => (
                <li key={i}>
                  <span className="xbank">{x.bank_name}</span>
                  {' — '}
                  <span className="xreason">{x.reason}</span>
                </li>
              ))}
              {rec.exclusion_log.length === 0 && <li style={{ color: 'var(--text-faint)' }}>No exclusions — all banks eligible.</li>}
            </ul>
          </details>
        </>
      ) : (
        <div style={{ padding: '24px 0', color: 'var(--red)' }}>
          No eligible bank found for {rec.currency_leg}. Review exclusion log:
          <ul className="exclusion-list" style={{ marginTop: 10 }}>
            {rec.exclusion_log.map((x, i) => (
              <li key={i}>
                <span className="xbank">{x.bank_name}</span> — <span className="xreason">{x.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.manual_review_flag && !isOverride && (
        <div className="info-banner" style={{ marginTop: 14, marginBottom: 0 }}>
          Manual review recommended — low confidence or ambiguous routing.
        </div>
      )}
    </div>
  );
}
