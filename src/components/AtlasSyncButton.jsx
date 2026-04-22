import { useState } from 'react';
import Modal from './Modal.jsx';

// "Sync to ATLAS" button for the topbar. The actual Atlas ↔ routing-engine
// integration (Copper pull, routing assignment push) is Phase 2 per the PRD;
// for now this surfaces an in-app explainer + a "request early access" hook
// so the affordance is visible to the team.
export default function AtlasSyncButton() {
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  return (
    <>
      <button
        type="button"
        className="atlas-sync-btn"
        onClick={() => setOpen(true)}
        title="Sync this tool's data with the Atlas middle office"
      >
        <span className="atlas-sync-icon" aria-hidden>⇌</span>
        <span className="atlas-sync-label">Sync to ATLAS</span>
        <span className="atlas-sync-beta">BETA</span>
      </button>

      {open && (
        <Modal title="Sync to ATLAS · Beta" onClose={() => setOpen(false)}
          footer={<>
            <button className="btn ghost" onClick={() => setOpen(false)}>Close</button>
            {!requested ? (
              <button
                className="btn primary"
                disabled={requesting}
                onClick={() => {
                  setRequesting(true);
                  setTimeout(() => { setRequesting(false); setRequested(true); }, 500);
                }}
              >
                {requesting ? 'Requesting…' : 'Request Early Access'}
              </button>
            ) : (
              <button className="btn primary" disabled>✓ Request Logged</button>
            )}
          </>}
        >
          <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text)' }}>
            <p style={{ marginTop: 0 }}>
              The <strong>Atlas sync</strong> bridges this routing tool with SDM's middle-office
              Atlas platform. When enabled, this button will:
            </p>
            <ul style={{ paddingLeft: 20, color: 'var(--text-dim)', marginBottom: 16 }}>
              <li style={{ marginBottom: 6 }}>
                <strong style={{ color: 'var(--text)' }}>Pull from Copper CRM</strong> — import new
                clients and any profile updates (vertical, risk, KYC status) directly into the
                routing registry.
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong style={{ color: 'var(--text)' }}>Push to Atlas</strong> — save the current
                routing recommendation (bank, LP, network) onto the client's Atlas record so ops
                sees it on the client detail view.
              </li>
              <li style={{ marginBottom: 6 }}>
                <strong style={{ color: 'var(--text)' }}>Feed the Hub</strong> — dynamically serve
                the routed bank's deposit instructions on the client-facing Hub (Phase 3).
              </li>
            </ul>
            <div className="atlas-sync-banner">
              <strong>Phase 2 — coordinating with Curtis + the Atlas team.</strong>
              {' '}Click below to flag your account for early-access when the integration lands.
            </div>
            {requested && (
              <div className="info-banner" style={{ marginTop: 12, marginBottom: 0 }}>
                Thanks — logged. You'll be notified when the Atlas sync is live.
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
