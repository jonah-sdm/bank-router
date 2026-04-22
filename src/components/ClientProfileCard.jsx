import { countryName } from '../lib/countries.js';
import { BUSINESS_VERTICALS } from '../engine/constants.js';

// Clean profile summary shown on the routing page when a client is selected.
// High-signal fields only. An "Edit" button opens the full form in a modal.
// When `isDirty` is true (unsaved edits in the profile state) a small pill
// is shown so ops knows there's a pending save.
export default function ClientProfileCard({ profile, isDirty = false, onEdit, onNew, isNew = false }) {
  if (isNew) {
    return (
      <div className="profile-card profile-card-empty">
        <div className="profile-empty-inner">
          <div className="profile-empty-title">No client selected</div>
          <div className="profile-empty-sub">
            Pick a client from the sidebar, or create a new one to start routing.
          </div>
          <div className="profile-empty-actions">
            <button className="btn primary" onClick={onNew}>
              + New Client
            </button>
          </div>
        </div>
      </div>
    );
  }

  const verticalLabel = BUSINESS_VERTICALS.find(v => v.code === profile.business_vertical)?.label;
  const jurisdictionName = countryName(profile.jurisdiction_country);
  const beneficiaryName = profile.beneficiary_country ? countryName(profile.beneficiary_country) : null;
  const settledCcys = profile.settlement_currencies || [];
  const methods = profile.settlement_methods || [];

  return (
    <div className={`profile-card ${isDirty ? 'dirty' : ''}`}>
      {/* Header row: name + action */}
      <div className="profile-head">
        <div className="profile-head-left">
          <h2 className="profile-name">{profile.client_name || 'Unnamed Client'}</h2>
          <div className="profile-badges">
            {profile.risk_rating && (
              <span className={`badge risk-${profile.risk_rating}`}>{profile.risk_rating} RISK</span>
            )}
            {profile.priority_tier && (
              <span className={`badge p-${profile.priority_tier}`}>{profile.priority_tier}</span>
            )}
            {profile.sdm_entity && (
              <span className="badge">{profile.sdm_entity.replace('SDM_', 'SDM ')}</span>
            )}
            {profile.entity_type && (
              <span className="badge">{profile.entity_type}</span>
            )}
            {profile.uses_stablecoins && (
              <span className="badge badge-amber">STABLES-IN</span>
            )}
            {isDirty && (
              <span className="badge badge-dirty">
                <span className="dirty-dot" style={{ width: 5, height: 5 }} />
                UNSAVED
              </span>
            )}
          </div>
        </div>
        <button className="btn primary profile-edit-btn" onClick={onEdit}>
          Edit Profile ✎
        </button>
      </div>

      {/* Info grid */}
      <div className="profile-grid">
        <ProfileField label="Business Vertical">
          {profile.business_vertical ? (
            <>
              <span className="profile-value-primary mono">{profile.business_vertical}</span>
              {verticalLabel && <span className="profile-value-sub">{verticalLabel}</span>}
            </>
          ) : <span className="profile-value-empty">—</span>}
        </ProfileField>

        <ProfileField label="Jurisdiction">
          {profile.jurisdiction_country ? (
            <>
              <span className="profile-value-primary">{jurisdictionName}</span>
              {jurisdictionName !== profile.jurisdiction_country && (
                <span className="profile-value-sub mono">{profile.jurisdiction_country}</span>
              )}
            </>
          ) : <span className="profile-value-empty">—</span>}
        </ProfileField>

        <ProfileField label="Beneficiary Country">
          {beneficiaryName ? (
            <>
              <span className="profile-value-primary">{beneficiaryName}</span>
              {beneficiaryName !== profile.beneficiary_country && (
                <span className="profile-value-sub mono">{profile.beneficiary_country}</span>
              )}
            </>
          ) : <span className="profile-value-empty">—</span>}
        </ProfileField>

        <ProfileField label="Settlement SLA">
          <span className="profile-value-primary mono">
            {profile.settlement_speed_sla?.replace(/_/g, ' ') || '—'}
          </span>
        </ProfileField>
      </div>

      {/* Currencies + methods chips row */}
      <div className="profile-chips-row">
        <div className="profile-chips-block">
          <div className="profile-chips-label">Settles In</div>
          <div className="profile-chips">
            {settledCcys.length > 0 ? settledCcys.map(c => (
              <span key={c} className="chip chip-ccy">{c}</span>
            )) : <span className="profile-value-empty">—</span>}
          </div>
        </div>

        <div className="profile-chips-block">
          <div className="profile-chips-label">Requested Method</div>
          <div className="profile-chips">
            {methods.length > 0 ? methods.map(m => (
              <span key={m} className="chip chip-method">{m}</span>
            )) : <span className="profile-value-empty">engine picks best</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, children }) {
  return (
    <div className="profile-field">
      <div className="profile-field-label">{label}</div>
      <div className="profile-field-value">{children}</div>
    </div>
  );
}
