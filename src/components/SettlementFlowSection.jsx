import { useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip.jsx';

// Settlement Flow visualisation. Renders a horizontal chain of step boxes for
// either the BUY direction (client deposits fiat → gets crypto) or SELL
// direction (client deposits crypto → gets fiat) of a single recommended
// bank. Direction is per-leg local state — each card decides independently.
//
// Step shape (from engine.buildSettlementFlow):
//   { kind, label, value, role, fx?, tier?, network?, note?, conditional?, reason? }
//
// kinds: 'client', 'sdm_bank', 'lp', 'sdm_fireblocks', 'sdm_intra_bank',
//        'client_wallet', 'client_bank'
// roles: 'external' (client side), 'sdm' (SDM-internal), 'lp' (counterparty)
//
// The LP step is special: it's swappable when multiple LPs are recommended
// for the leg. We replace the engine-rendered LP step value with the
// currently-selected LP from the parent.
export default function SettlementFlowSection({
  settlementFlow,
  bridgeFlow,
  currency,
  lps,
  selectedLp,
  onSelectLp,
  fallbackBankName,
  fallbackFeedstock,
  fallbackFxNeeded
}) {
  const [direction, setDirection] = useState('sell');

  // Defensive fallback when the engine didn't produce a flow (legacy data, no
  // bank, etc.). We render a minimal 3-step chain so the card still has shape.
  if (!settlementFlow) {
    return (
      <FallbackFlow
        currency={currency}
        bankName={fallbackBankName}
        feedstock={fallbackFeedstock}
        fxNeeded={fallbackFxNeeded}
        lps={lps}
        selectedLp={selectedLp}
        onSelectLp={onSelectLp}
      />
    );
  }

  const dirData = direction === 'buy' ? settlementFlow.buy : settlementFlow.sell;
  const steps = dirData?.steps || [];

  return (
    <div className="settlement-flow">
      {bridgeFlow && (
        <div className="settlement-bridge">
          <div className="settlement-flow-head">
            <div className="settlement-flow-title">
              Crypto Bridge · {bridgeFlow.origin_network} → {bridgeFlow.target_network}
            </div>
            <span className="settlement-bridge-tag">{bridgeFlow.via_entity} · {bridgeFlow.exchange}</span>
          </div>
          <div className="settlement-flow-banner settlement-flow-banner-bridge">
            <span className="banner-dot" />
            <span>
              <strong>Cross-chain crypto swap:</strong> Greenline (SDM's entity on HTX) bridges
              {' '}{bridgeFlow.origin_network} → {bridgeFlow.target_network} before / after the fiat leg.
            </span>
          </div>
          <div className="flow-chain">
            {bridgeFlow.steps.map((step, idx) => (
              <FlowStep
                key={`bridge-${step.kind}-${idx}`}
                step={step}
                isLast={idx === bridgeFlow.steps.length - 1}
                lps={[]}
                selectedLp={null}
                onSelectLp={() => {}}
              />
            ))}
          </div>
        </div>
      )}
      <div className="settlement-flow-head">
        <div className="settlement-flow-title">Settlement Flow</div>
        <div className="settlement-flow-toggle" role="tablist" aria-label="Flow direction">
          <button
            role="tab"
            aria-selected={direction === 'sell'}
            className={`flow-toggle-btn ${direction === 'sell' ? 'active' : ''}`}
            onClick={() => setDirection('sell')}
            title="Client sends crypto, receives fiat"
          >
            Sell · crypto → {currency}
          </button>
          <button
            role="tab"
            aria-selected={direction === 'buy'}
            className={`flow-toggle-btn ${direction === 'buy' ? 'active' : ''}`}
            onClick={() => setDirection('buy')}
            title="Client sends fiat, receives crypto"
          >
            Buy · {currency} → crypto
          </button>
        </div>
      </div>

      {settlementFlow.has_intra_bank && direction === 'sell' && (
        <div className="settlement-flow-banner">
          <span className="banner-dot" />
          <span>
            <strong>HIGH-risk routing:</strong> {settlementFlow.intra_bank.reason}
          </span>
        </div>
      )}

      <div className="flow-chain">
        {steps.map((step, idx) => (
          <FlowStep
            key={`${direction}-${step.kind}-${idx}`}
            step={step}
            isLast={idx === steps.length - 1}
            lps={lps}
            selectedLp={selectedLp}
            onSelectLp={onSelectLp}
          />
        ))}
      </div>
    </div>
  );
}

// Render one step in the chain. Most kinds are a static box; 'lp' becomes a
// dropdown picker when multiple LPs are eligible.
function FlowStep({ step, isLast, lps, selectedLp, onSelectLp }) {
  const arrow = !isLast && <span className="flow-arrow" aria-hidden>→</span>;

  if (step.kind === 'lp' && Array.isArray(lps) && lps.length > 0) {
    return (
      <>
        <LPFlowPicker
          lps={lps}
          selected={selectedLp}
          onSelect={onSelectLp}
          value={step.value}
          note={step.note}
        />
        {arrow}
      </>
    );
  }

  const roleClass = `flow-step-role-${step.role || 'external'}`;
  const conditionalClass = step.conditional ? 'flow-step-conditional' : '';
  const intercompanyClass = step.intercompany ? 'flow-step-intercompany' : '';
  const bridgeClass = step.bridge ? 'flow-step-bridge' : '';
  const fxClass = step.fx ? 'flow-step-fx' : '';
  const tagClass = step.intercompany
    ? 'flow-step-tag flow-step-tag-intercompany'
    : step.bridge
      ? 'flow-step-tag flow-step-tag-bridge'
      : 'flow-step-tag';

  const box = (
    <div className={`flow-step flow-step-static ${roleClass} ${conditionalClass} ${intercompanyClass} ${bridgeClass} ${fxClass}`}>
      <div className="flow-step-label">
        {step.role === 'sdm' && <span className={tagClass}>SDM</span>}
        {step.role === 'lp' && step.bridge && <span className={tagClass}>HTX</span>}
        {step.label}
      </div>
      <div className="flow-step-value mono">{step.value || '—'}</div>
      {step.network && <div className="flow-step-meta mono">{step.network}</div>}
      {step.note && <div className="flow-step-note">{step.note}</div>}
      {step.conditional && <div className="flow-step-cond-pill">conditional</div>}
    </div>
  );

  if (step.intercompany) {
    return (
      <>
        <Tooltip content="SDM_USA clients trade with SDM_INC as the intermediate counterparty. SDM_INC places the LP order, then funds wire bank-to-bank into the SDM_USA bank.">{box}</Tooltip>
        {arrow}
      </>
    );
  }

  if (step.conditional && step.reason) {
    return (
      <>
        <Tooltip content={step.reason}>{box}</Tooltip>
        {arrow}
      </>
    );
  }

  return <>{box}{arrow}</>;
}

// Clickable LP step. Opens a popover listing every LP eligible for the leg,
// so ops can override the engine's pick in-place.
function LPFlowPicker({ lps, selected, onSelect, value, note }) {
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
      className={`flow-step flow-step-role-lp flow-lp ${multi ? 'has-dropdown' : ''} ${open ? 'open' : ''}`}
      onClick={() => multi && setOpen(v => !v)}
      role={multi ? 'button' : undefined}
      tabIndex={multi ? 0 : undefined}
      onKeyDown={(e) => { if (multi && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(v => !v); } }}
    >
      <div className="flow-step-label">
        <span className="flow-step-tag flow-step-tag-lp">LP</span>
        {selected?.lp_name || 'LP'}
        {multi && <span className="flow-step-chev">{open ? '▴' : '▾'}</span>}
      </div>
      <div className="flow-step-value mono">{value || '—'}</div>
      {note && <div className="flow-step-note">{note}</div>}

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

// Renders a minimal sell-direction chain when the engine didn't supply a
// settlement_flow. Shouldn't happen in normal usage but keeps the card from
// blowing up on legacy / partial data.
function FallbackFlow({ currency, bankName, feedstock, fxNeeded, lps, selectedLp, onSelectLp }) {
  return (
    <div className="settlement-flow">
      <div className="settlement-flow-head">
        <div className="settlement-flow-title">Settlement Flow</div>
      </div>
      <div className="flow-chain">
        <div className="flow-step flow-step-static flow-step-role-external">
          <div className="flow-step-label">Client</div>
          <div className="flow-step-value mono">crypto in</div>
        </div>
        <span className="flow-arrow" aria-hidden>→</span>
        <LPFlowPicker
          lps={lps || []}
          selected={selectedLp}
          onSelect={onSelectLp}
          value={feedstock || currency}
          note="crypto → fiat trade"
        />
        <span className="flow-arrow" aria-hidden>→</span>
        <div className={`flow-step flow-step-static flow-step-role-sdm ${fxNeeded ? 'flow-step-fx' : ''}`}>
          <div className="flow-step-label">
            <span className="flow-step-tag">SDM</span>
            {bankName || 'Bank'}
          </div>
          <div className="flow-step-value mono">
            {fxNeeded ? `FX: ${feedstock} → ${currency}` : 'passthrough'}
          </div>
        </div>
        <span className="flow-arrow" aria-hidden>→</span>
        <div className="flow-step flow-step-static flow-step-role-external">
          <div className="flow-step-label">Client Bank</div>
          <div className="flow-step-value mono">{currency} out</div>
        </div>
      </div>
    </div>
  );
}
