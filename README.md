# SDM Atlas — Client-Bank-LP Routing Engine

Internal decision-support tool that recommends the optimal banking partner and liquidity provider for each SDM client, per currency and settlement method. Encodes the tribal-knowledge routing logic from ops into a configurable, auditable rule engine.

See `SDM_Client_Bank_LP_Routing_Engine_PRD.docx` for the full product spec.

## Stack

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Supabase (Postgres + auto API + Auth + realtime)
- **Routing engine:** pure JavaScript module in `src/engine/routing.js` — no I/O, unit-tested against PRD Appendix A
- **Tests:** Vitest
- **Theme:** SDM dark — amber `#F5A623`, Sora + JetBrains Mono

## Running locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # routing engine unit tests
```

The app runs in **demo mode** (in-memory mock data mirroring PRD seed) until Supabase credentials are provided. All CRUD works in demo mode; changes just don't persist across reloads.

## Wiring up Supabase

1. Create a new Supabase project at https://supabase.com
2. In the SQL editor, run `supabase/migrations/0001_init.sql` then `0002_seed.sql`
3. Copy `.env.example` → `.env` and fill in:
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Project Settings → API → `anon` public key
4. Restart `npm run dev`

## Routes

- `/routing` — production routing decision tool (input profile → recommendation per currency)
- `/admin/banks` — bank registry CRUD
- `/admin/lps` — LP registry CRUD
- `/admin/clients` — client registry CRUD
- `/admin/weights` — scoring weight configuration (sliders)
- `/admin/audit` — audit log viewer

## Architecture

```
src/
  engine/
    constants.js        enums, ripple corridors, tier/pricing scores
    routing.js          pure function: computeRouting(profile, banks, lps, weights)
    routing.test.js     validates against PRD Appendix A
  lib/
    supabase.js         Supabase client + feature flag
    dataStore.js        data-access layer (Supabase OR in-memory fallback)
    mockData.js         demo-mode seed (mirrors 0002_seed.sql)
  pages/
    RoutingPage.jsx     main production page
    AdminPage.jsx       banks / lps / clients / weights / audit tabs
  components/
    ClientForm.jsx      shared input form for profile
    RecommendationCard.jsx  per-currency output card
    BankEditor.jsx      admin form for banks
    LPEditor.jsx        admin form for LPs
    Modal.jsx           modal shell
  styles/theme.css      SDM design system

supabase/migrations/
  0001_init.sql         schema + enums + audit triggers + RLS
  0002_seed.sql         9 banks + sample LPs
```

## Routing engine contract

Per PRD §8.4, the engine is a pure function:

```js
computeRouting(profile, banks, lps, weights) -> RoutingRecommendation[]
```

This means the engine can run in:
- the browser (current),
- a Supabase Edge Function (Phase 2 — Hub calls it),
- a Node server (if Atlas needs it),

…without any rewrite. Same file, same code.

## Phase status

- [x] **Phase 1a** — Standalone routing tool, bank/LP/client registries, scoring weight config, audit log, Appendix A validation
- [ ] **Phase 1b** — Atlas client profile integration (Banking & LP panel, save routing to client record)
- [ ] **Phase 1c** — LP tier data from trading desk, LP scoring weights
- [ ] **Phase 2** — Copper CRM read integration
- [ ] **Phase 3** — Client-facing Hub integration (dynamic bank details)
