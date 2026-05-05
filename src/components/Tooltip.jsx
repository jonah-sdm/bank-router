import { useState, useRef, useEffect } from 'react';

// Lightweight CSS-only tooltip. Wrap any element to add a hover/focus tooltip.
// Stays open while the user hovers either the trigger OR the bubble (so they
// can read multi-line content). Esc dismisses.
//
//   <Tooltip content="Some explanatory text" position="top">
//     <span className="badge">T1</span>
//   </Tooltip>
export default function Tooltip({ content, children, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function scheduleHide() {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  }

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      {children}
      {open && (
        <span
          className={`tooltip tooltip-${position}`}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          {content}
        </span>
      )}
    </span>
  );
}

// Per-tier explanatory copy. Imported by anywhere that displays a tier badge.
export const BANK_TIER_DESCRIPTIONS = {
  T1:            'Preferred banks — best fees, fastest, most reliable. Default first choice for the currencies they cover.',
  T1_CAD:        'CAD-domestic preferred bank. ConnectFirst CU is the canonical pick for Canadian-jurisdiction clients.',
  T2:            'Higher-cost, higher-risk-tolerant banks. Use when T1 declines or for HIGH-risk clients.',
  T2_SPECIALIST: 'Specialist rail (Ripple ODL). Stables-to-fiat settlement only — niche corridors (AED/UAE, EUR/SEPA, GBP/UK, USD/CN with stables-in).',
  T3:            'Tertiary banks — lower priority. Used when no better option exists or for legacy account flows.',
  T3_DEDICATED:  'Reserved for specific clients. Hamilton Reserve Bank (HRB) is currently used for one client tied to a specific salesperson — not for new client routing.'
};
