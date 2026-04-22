import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ClientForm from '../components/ClientForm.jsx';
import RecommendationCard from '../components/RecommendationCard.jsx';
import CollapsibleCard from '../components/CollapsibleCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import ClientListSidebar from '../components/ClientListSidebar.jsx';
import { computeRouting } from '../engine/routing.js';
import {
  listBanks, listLPs, listClients, getWeights, listAffinity, upsertClient
} from '../lib/dataStore.js';
import { useDataChange } from '../lib/dataEvents.js';
import { useQuickAdd } from '../lib/quickAddContext.jsx';

const BLANK_PROFILE = {
  client_name: '',
  sdm_entity: 'SDM_INC',
  entity_type: 'CORPORATION',
  business_vertical: '',
  jurisdiction_country: '',
  risk_rating: 'LOW',
  currencies_traded: [],
  settlement_currencies: [],
  settlement_methods: [],
  settlement_speed_sla: 'T1_NEXT_DAY',
  beneficiary_country: '',
  uses_stablecoins: false,
  priority_tier: 'P2'
};

export default function RoutingPage() {
  const [banks, setBanks] = useState([]);
  const [lps, setLPs] = useState([]);
  const [clients, setClients] = useState([]);
  const [weights, setWeights] = useState(null);
  const [affinity, setAffinity] = useState([]);
  const [profile, setProfile] = useState(BLANK_PROFILE);
  const [originalSnapshot, setOriginalSnapshot] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { openQuickAdd } = useQuickAdd();

  // Save-button state: inline double-click confirmation
  const [saveArmed, setSaveArmed] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const saveTimer = useRef(null);

  // "Save as new" modal
  const [saveAsNew, setSaveAsNew] = useState(null);

  // Load-different-client confirm when dirty
  const [pendingLoadId, setPendingLoadId] = useState(null);

  // Recompute indicator
  const [recomputing, setRecomputing] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setRecomputing(true);
    const t = setTimeout(() => setRecomputing(false), 450);
    return () => clearTimeout(t);
  }, [profile]);

  // ---------- data loading ----------
  async function reload() {
    try {
      setLoading(true);
      const [b, l, c, w, a] = await Promise.all([
        listBanks(), listLPs(), listClients(), getWeights(), listAffinity()
      ]);
      setBanks(b); setLPs(l); setClients(c); setWeights(w); setAffinity(a);
      setError(null);
      return c;
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload().then(loadedClients => {
      // Auto-load from ?client=:id
      const paramId = searchParams.get('client');
      if (paramId && loadedClients) {
        const c = loadedClients.find(x => x.client_id === paramId);
        if (c) applyLoadedClient(c);
      }
      if (searchParams.get('reset') === '1') {
        setProfile(BLANK_PROFILE);
        setOriginalSnapshot(null);
        setSelectedClientId('');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDataChange('clients', reload);
  useDataChange('banks', reload);
  useDataChange('lps', reload);
  useDataChange('affinity', reload);
  useDataChange('weights', reload);

  // ---------- dirty-state detection ----------
  // Dirty when:
  //   (a) a client is loaded and the form differs from the loaded snapshot, OR
  //   (b) no client is loaded but the form has meaningful content (offer Save as New)
  const isDirty = useMemo(() => {
    if (originalSnapshot) {
      return JSON.stringify(profile) !== JSON.stringify(originalSnapshot);
    }
    return !!(profile.client_name || profile.business_vertical ||
      profile.jurisdiction_country ||
      (profile.settlement_currencies?.length > 0));
  }, [profile, originalSnapshot]);

  function applyLoadedClient(c) {
    const merged = { ...BLANK_PROFILE, ...c };
    setProfile(merged);
    setOriginalSnapshot(merged);
    setSelectedClientId(c.client_id);
    setSaveArmed(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }

  function loadClient(id) {
    // If dirty, confirm before loading a different client
    if (isDirty && id !== selectedClientId) {
      setPendingLoadId(id);
      return;
    }
    setSelectedClientId(id);
    if (!id) {
      setProfile(BLANK_PROFILE);
      setOriginalSnapshot(null);
      setSearchParams({});
      return;
    }
    const c = clients.find(x => x.client_id === id);
    if (c) applyLoadedClient(c);
  }

  // ---------- save flow ----------
  function armOrSave() {
    if (!saveArmed) {
      setSaveArmed(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveArmed(false), 3000);
      return;
    }
    commitSave();
  }
  async function commitSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveArmed(false);
    try {
      const saved = await upsertClient(profile);
      // Supabase returns the full row including created_at / updated_at which
      // the profile state doesn't track. Sync BOTH profile and originalSnapshot
      // to the saved record so the dirty-state comparison stays stable.
      const merged = { ...BLANK_PROFILE, ...saved };
      setProfile(merged);
      setOriginalSnapshot(merged);
      setSelectedClientId(saved.client_id);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1800);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }
  function discard() {
    if (originalSnapshot) setProfile(originalSnapshot);
    setSaveArmed(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }

  async function saveAsNewClient() {
    if (!saveAsNew?.name?.trim()) return;
    try {
      const draft = { ...profile, client_name: saveAsNew.name.trim() };
      delete draft.client_id;
      const saved = await upsertClient(draft);
      applyLoadedClient(saved);
      setSaveAsNew(null);
    } catch (e) {
      setError(e.message ?? String(e));
      setSaveAsNew(null);
    }
  }

  // ---------- recommendations ----------
  const recommendations = useMemo(() => {
    if (!profile.settlement_currencies?.length && !profile.currencies_traded?.length) return [];
    if (!profile.business_vertical || !profile.sdm_entity || !profile.risk_rating) return [];
    try {
      return computeRouting(profile, banks, lps, weights || undefined, affinity);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [profile, banks, lps, weights, affinity]);

  const clientSummary = useMemo(() => {
    const bits = [
      profile.client_name || null,
      profile.sdm_entity ? profile.sdm_entity.replace('SDM_', '') : null,
      profile.business_vertical || null,
      profile.jurisdiction_country || null,
      profile.risk_rating || null,
      profile.settlement_currencies?.length ? profile.settlement_currencies.join(',') : null,
      profile.settlement_speed_sla || null,
      profile.priority_tier || null
    ].filter(Boolean);
    return bits.length ? bits.join(' · ') : 'no client loaded';
  }, [profile]);

  const kpi = useMemo(() => {
    const total = recommendations.length;
    const high = recommendations.filter(r => r.confidence === 'HIGH').length;
    const review = recommendations.filter(r => r.manual_review_flag).length;
    const instant = recommendations.filter(r =>
      ['CUBIX','BLINK','RIPPLE_ODL'].includes(r.settlement_network)
    ).length;
    return { total, high, review, instant };
  }, [recommendations]);

  const loadedClientName = clients.find(c => c.client_id === selectedClientId)?.client_name;
  const loadedClientRecord = clients.find(c => c.client_id === selectedClientId);

  // ---------- header indicator: amber dot when dirty, Edit-in-Admin link when clean ----------
  const headerIndicator = (
    <div className="save-header-indicator">
      {saveFlash && <span className="save-flash">Saved ✓</span>}
      {isDirty && <span className="dirty-dot" title="Unsaved changes" />}
      {!isDirty && selectedClientId && loadedClientRecord && (
        <button
          className="btn small ghost edit-in-admin"
          title="Edit this client in admin"
          onClick={() => openQuickAdd({ kind: 'client', record: loadedClientRecord })}
        >
          Edit in Admin →
        </button>
      )}
    </div>
  );

  // ---------- dirty strip: prominent save/discard row inside the card body ----------
  const dirtyStrip = isDirty && (
    <div className="dirty-strip">
      <div className="dirty-strip-left">
        <span className="dirty-strip-dot" />
        <span className="dirty-strip-label">Unsaved changes</span>
      </div>
      <div className="dirty-strip-right">
        {selectedClientId ? (
          <>
            <button className="btn small ghost" onClick={discard}>Discard</button>
            <button
              className={`btn small ${saveArmed ? 'armed' : 'primary'}`}
              onClick={armOrSave}
              title={`Save to ${loadedClientName}`}
            >
              {saveArmed ? 'Click again to confirm' : 'Save'}
            </button>
          </>
        ) : (profile.client_name || profile.business_vertical) && (
          <button className="btn small primary"
            onClick={() => setSaveAsNew({ name: profile.client_name || '' })}>
            Save as New Client…
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="title-row">
        <div>
          <h1 className="page-title">Routing Decision Tool</h1>
          <p className="page-sub">
            Input a client profile → receive per-currency bank + LP recommendations with full audit trail.
          </p>
        </div>
        <div className={`live-pill ${recomputing ? 'active' : ''}`}>
          <span className="live-dot" />
          {recomputing ? 'RECOMPUTING' : 'LIVE'}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="routing-split">
        <ClientListSidebar
          clients={clients}
          selectedId={selectedClientId}
          onSelect={loadClient}
          onNew={() => loadClient('')}
        />

        <div className="routing-main">
          <div className="kpi-row">
            <div className="kpi">
              <div className="v">{kpi.total}</div>
              <div className="k">Currency legs</div>
            </div>
            <div className="kpi">
              <div className="v">{kpi.high}</div>
              <div className="k">High confidence</div>
            </div>
            <div className="kpi">
              <div className="v">{kpi.instant}</div>
              <div className="k">Instant settlement</div>
            </div>
            <div className="kpi">
              <div className="v">{kpi.review}</div>
              <div className="k">Manual review</div>
            </div>
          </div>

          <CollapsibleCard
            title={selectedClientId && loadedClientName ? `Profile · ${loadedClientName}` : 'Client Profile'}
            storageKey="sdm_routing_profile"
            summary={clientSummary}
            headerRight={headerIndicator}
          >
            {dirtyStrip}
            <ClientForm value={profile} onChange={setProfile} />
          </CollapsibleCard>

          {loading && <div className="empty-state">Loading registry…</div>}

          {!loading && recommendations.length === 0 && (
            <div className="empty-state" style={{ marginTop: 16 }}>
              <div className="big">↳</div>
              Fill out the client profile above to see routing recommendations.
              <br /><br />
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                Requires: SDM entity, business vertical, risk rating, and at least one settlement currency.
              </span>
            </div>
          )}

          <div className={`rec-grid ${recomputing ? 'recomputing' : ''}`}>
            {recommendations.map(rec => (
              <RecommendationCard key={rec.currency_leg} rec={rec} />
            ))}
          </div>
        </div>
      </div>

      {/* Confirm discard-before-load */}
      <ConfirmDialog
        open={!!pendingLoadId}
        title="Discard unsaved changes?"
        body={`You have unsaved changes to ${loadedClientName || 'the current profile'}. Loading a different client will discard them.`}
        confirmLabel="Discard and load"
        danger
        onConfirm={() => {
          const id = pendingLoadId;
          setPendingLoadId(null);
          if (!id) return;
          const c = clients.find(x => x.client_id === id);
          if (c) applyLoadedClient(c);
        }}
        onCancel={() => setPendingLoadId(null)}
      />

      {/* Save-as-new modal */}
      {saveAsNew && (
        <Modal
          title="Save as new client"
          onClose={() => setSaveAsNew(null)}
          footer={<>
            <button className="btn ghost" onClick={() => setSaveAsNew(null)}>Cancel</button>
            <button className="btn primary" onClick={saveAsNewClient}
              disabled={!saveAsNew.name?.trim()}>Create client</button>
          </>}
        >
          <label className="field">
            Client Name
            <input
              type="text"
              autoFocus
              value={saveAsNew.name || ''}
              onChange={e => setSaveAsNew({ name: e.target.value })}
              placeholder="Legal entity name"
            />
          </label>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
            Saves the current profile as a new client. All other fields (vertical, risk, currencies, etc.)
            are carried over from what you've filled in.
          </div>
        </Modal>
      )}
    </>
  );
}
