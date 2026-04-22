import { useState, useEffect, useRef } from 'react';
import sdmShield from '../assets/sdm-shield.svg';

// Client-side password gate. SECURITY CAVEAT: this is obfuscation only —
// the password constant ships in the JS bundle, so anyone with devtools
// can bypass it. Good enough to keep casual visitors out of an internal
// tool; not real auth. When we need real auth, wire up Supabase Auth
// (email magic link / Google SSO) and switch this to check the session.

// Expected password obfuscated in base64 so it isn't a grep target in the
// bundle. Decoded value: 'SDM123!'
const EXPECTED_B64 = 'U0RNMTIzIQ==';
const STORAGE_KEY = 'sdm_gate_ok';

export default function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch { return false; }
  });
  const [value, setValue] = useState('');
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (!authed) inputRef.current?.focus(); }, [authed]);

  function submit(e) {
    e?.preventDefault?.();
    const expected = atob(EXPECTED_B64);
    if (value === expected) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
      setAuthed(true);
    } else {
      setErr(true);
      setShake(true);
      setTimeout(() => setShake(false), 350);
    }
  }

  if (authed) return children;

  return (
    <div className="gate-shell">
      <div className={`gate-card ${shake ? 'shake' : ''}`}>
        <img src={sdmShield} alt="" className="gate-shield" aria-hidden="true" />
        <div className="gate-kicker">SDM ATLAS</div>
        <h1 className="gate-title">Routing Engine</h1>
        <p className="gate-sub">Internal tool. Enter the team password to continue.</p>

        <form onSubmit={submit} className="gate-form">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setErr(false); }}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            className={err ? 'gate-input error' : 'gate-input'}
          />
          <button type="submit" className="btn primary large gate-submit"
            disabled={!value}>
            Unlock →
          </button>
        </form>

        {err && (
          <div className="gate-err">Incorrect password. Try again.</div>
        )}

        <div className="gate-foot">
          Forgot the password? Ask Jonah.
        </div>
      </div>
    </div>
  );
}
