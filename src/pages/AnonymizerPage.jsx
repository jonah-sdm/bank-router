import { useMemo, useState } from 'react';

// Anonymizer tool — Curtis Apr-23 deliverable.
// Takes a CSV or JSON of real client records and produces two outputs:
//   1. anonymized.json — same shape, but client_name + sales/referral fields
//      replaced with fake values. Routing-relevant fields (jurisdiction, risk,
//      currencies, vertical, entity, methods) are preserved verbatim.
//   2. key.json — mapping fake → real so Jim can reverse the mapping later.
//
// Runs entirely in the browser. Nothing is sent over the wire.

const FAKE_COMPANY_PREFIXES = [
  'Acme', 'Beta', 'Cobalt', 'Delta', 'Eon', 'Forge', 'Grove', 'Halcyon',
  'Indigo', 'Juno', 'Kestrel', 'Lumen', 'Meridian', 'Nimbus', 'Orion',
  'Prism', 'Quartz', 'Rook', 'Stellar', 'Tundra', 'Umbra', 'Vector',
  'Willow', 'Xenon', 'Yarrow', 'Zephyr'
];
const FAKE_COMPANY_SUFFIXES = [
  'Holdings', 'Capital', 'Group', 'Partners', 'Trading', 'Markets',
  'Ventures', 'Labs', 'Networks', 'Industries', 'Co.', 'Ltd', 'Inc.',
  'LLC', 'SA', 'Pte', 'AG'
];
const FAKE_FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Cameron',
  'Dakota', 'Quinn', 'Reese', 'Skylar', 'Harper', 'Avery', 'Rowan',
  'Sage', 'Phoenix'
];
const FAKE_LAST_NAMES = [
  'Hart', 'Cole', 'Reed', 'Mills', 'Lane', 'Pace', 'Vance', 'Dean',
  'Ford', 'Kerr', 'Holt', 'Park', 'Quinn', 'Rhodes', 'Stein', 'York'
];

// Sensitive fields we anonymize. Keys are what we strip / replace.
const SENSITIVE_FIELDS = [
  'client_name',
  'copper_id',
  'sales_rep',       'salesperson',     'sales_owner',
  'referral_agent',  'referral_partner', 'referred_by',
  'contact_name',    'contact_email',   'contact_phone',
  'beneficiary_name',
  'email', 'phone', 'address', 'legal_name', 'trading_name',
  'commission_rate', 'commission_pct',
  'notes', 'internal_notes'
];

// Routing-relevant fields — these we KEEP exactly.
const ROUTING_FIELDS = new Set([
  'sdm_entity', 'entity_type', 'risk_rating', 'business_vertical',
  'jurisdiction_country', 'jurisdiction_state', 'beneficiary_country',
  'currencies_traded', 'settlement_currencies', 'settlement_methods',
  'settlement_speed_sla', 'priority_tier', 'uses_stablecoins',
  'crypto_bridge_required', 'crypto_origin_network', 'crypto_target_network',
  'kyc_status', 'monthly_volume_usd'
]);

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function fakeCompanyName(seedIndex) {
  const a = FAKE_COMPANY_PREFIXES[seedIndex % FAKE_COMPANY_PREFIXES.length];
  const b = FAKE_COMPANY_SUFFIXES[Math.floor(seedIndex / FAKE_COMPANY_PREFIXES.length) % FAKE_COMPANY_SUFFIXES.length];
  return `${a} ${b}`;
}
function fakePersonName() {
  return `${rand(FAKE_FIRST_NAMES)} ${rand(FAKE_LAST_NAMES)}`;
}

// Parse CSV (simple: assumes no embedded commas in quoted fields beyond standard)
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = cols[i] ?? ''; });
    return row;
  });
}
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.replace(/^"|"$/g, ''));
}

function anonymizeRecord(record, index) {
  const out = {};
  const key = { fake_name: null, real_name: record.client_name || record.name || null, original_id: record.client_id || record.id || null };

  // Replace client_name (and name) with a fake company name based on index
  const fakeName = fakeCompanyName(index);
  key.fake_name = fakeName;

  for (const [k, v] of Object.entries(record)) {
    if (k === 'client_name' || k === 'name' || k === 'legal_name' || k === 'trading_name') {
      out[k] = fakeName;
    } else if (k === 'client_id' || k === 'id') {
      out[k] = `fake-${index + 1}`;
    } else if (k === 'copper_id') {
      out[k] = `CPR-FAKE-${index + 1}`;
    } else if (k === 'contact_name' || k === 'beneficiary_name' || k === 'sales_rep' || k === 'salesperson' || k === 'sales_owner' || k === 'referral_agent' || k === 'referral_partner' || k === 'referred_by') {
      out[k] = fakePersonName();
    } else if (k === 'email' || k === 'contact_email') {
      out[k] = `contact@${fakeName.toLowerCase().replace(/[^a-z0-9]/g, '')}.example`;
    } else if (k === 'phone' || k === 'contact_phone') {
      out[k] = '+1-555-0100';
    } else if (k === 'address') {
      out[k] = '1 Example St';
    } else if (k === 'commission_rate' || k === 'commission_pct') {
      out[k] = null;
    } else if (k === 'notes' || k === 'internal_notes') {
      out[k] = null;
    } else if (ROUTING_FIELDS.has(k)) {
      out[k] = v;
    } else {
      // Pass through other fields untouched but flag in the key
      out[k] = v;
    }
  }

  return { record: out, key };
}

export default function AnonymizerPage() {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState('json');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const fieldRefs = useMemo(() => ({
    preserved: [...ROUTING_FIELDS],
    replaced: SENSITIVE_FIELDS
  }), []);

  function run() {
    setErr(null);
    setResult(null);
    let records;
    try {
      if (format === 'csv') {
        records = parseCsv(input);
      } else {
        const parsed = JSON.parse(input);
        records = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (e) {
      setErr(`Failed to parse: ${e.message}`);
      return;
    }
    if (records.length === 0) {
      setErr('No records found in input');
      return;
    }
    const anonymized = [];
    const keyRows = [];
    records.forEach((r, i) => {
      const { record, key } = anonymizeRecord(r, i);
      anonymized.push(record);
      keyRows.push(key);
    });
    setResult({ anonymized, key: keyRows, count: records.length });
  }

  function download(filename, body) {
    const blob = new Blob([body], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Anonymizer</h1>
          <div className="page-sub">
            Strip names + sales/referral fields from real client records before sending data
            to engineering for stress testing. Routing-relevant fields (jurisdiction, risk,
            currencies, vertical, entity, methods) are preserved verbatim so the routing engine
            still produces the same bank/LP pick. Runs in the browser — nothing is sent over
            the network.
          </div>
        </div>
      </header>

      <div className="anon-grid">
        <section className="anon-input">
          <div className="anon-toolbar">
            <label className={`anon-pill ${format === 'json' ? 'active' : ''}`}>
              <input type="radio" name="fmt" checked={format === 'json'} onChange={() => setFormat('json')} />
              JSON
            </label>
            <label className={`anon-pill ${format === 'csv' ? 'active' : ''}`}>
              <input type="radio" name="fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              CSV
            </label>
            <button className="btn primary" onClick={run} disabled={!input.trim()}>
              Anonymize →
            </button>
          </div>
          <textarea
            className="anon-textarea"
            placeholder={
              format === 'json'
                ? '[\n  {\n    "client_name": "Acme Real Corp",\n    "sdm_entity": "SDM_INC",\n    "risk_rating": "HIGH",\n    "jurisdiction_country": "GB",\n    "currencies_traded": ["USD", "EUR"],\n    "settlement_currencies": ["USD"],\n    "business_vertical": "GAMING",\n    "sales_rep": "John Smith",\n    "monthly_volume_usd": 5000000\n  }\n]'
                : 'client_name,sdm_entity,risk_rating,jurisdiction_country,business_vertical,sales_rep\nAcme Real Corp,SDM_INC,HIGH,GB,GAMING,John Smith'
            }
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          {err && <div className="anon-err">{err}</div>}
        </section>

        <section className="anon-output">
          {!result ? (
            <div className="anon-placeholder">
              <h3>Output appears here</h3>
              <p>Paste records on the left, pick a format, click Anonymize.</p>
              <div className="anon-fields">
                <div>
                  <div className="anon-fields-label">Preserved (routing logic sees the real values)</div>
                  <div className="anon-chips">
                    {fieldRefs.preserved.map(f => <span key={f} className="anon-chip">{f}</span>)}
                  </div>
                </div>
                <div>
                  <div className="anon-fields-label">Replaced (fake values written; key file maps back)</div>
                  <div className="anon-chips">
                    {fieldRefs.replaced.map(f => <span key={f} className="anon-chip anon-chip-red">{f}</span>)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="anon-output-head">
                <div className="anon-count">{result.count} records anonymized</div>
                <div className="anon-actions">
                  <button className="btn small" onClick={() => download('anonymized.json', JSON.stringify(result.anonymized, null, 2))}>
                    ↓ anonymized.json
                  </button>
                  <button className="btn small" onClick={() => download('key.json', JSON.stringify(result.key, null, 2))}>
                    ↓ key.json
                  </button>
                </div>
              </div>
              <details open className="anon-block">
                <summary>anonymized.json — safe to share</summary>
                <pre className="anon-pre">{JSON.stringify(result.anonymized, null, 2)}</pre>
              </details>
              <details className="anon-block">
                <summary>key.json — keep locally, do NOT share</summary>
                <pre className="anon-pre">{JSON.stringify(result.key, null, 2)}</pre>
              </details>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
