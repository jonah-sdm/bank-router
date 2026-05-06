# SDM Atlas Bank Router — Phase 1 Sign-off Checklist

This is the list of things Curtis (Trading), Jim (Middle Office), and Ops need
to confirm before we cut over the engine into Atlas. Tick each row in the live
preview at https://bank-router.vercel.app (gate password: `SDM123!`). Anything
that fails goes back to engineering before the port begins.

Owner column: **C** = Curtis, **J** = Jim, **E** = Engineering.

---

## 1. Bank registry — coverage & accuracy

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 1.1 | Every active SDM banking partner is present in `Registry → Banks` with the correct tier, supported currencies, and settlement networks. | C / J | ☐ |
| 1.2 | Proprietary networks (CUBIX on Customers Bank, BLINK on BCB, RIPPLE_ODL where eligible) are listed against the right bank. | C | ☐ |
| 1.3 | `accepts_lp_currencies` reflects what each bank is actually willing to receive from an LP wire (vs. what they will pay out). | C / J | ☐ |
| 1.4 | Risk-rating ceilings (`max_client_risk`) match each bank's onboarding policy. | J | ☐ |
| 1.5 | SDM-entity allowlist on each bank is correct (which SDM legal entity actually banks there). | J | ☐ |

## 2. LP registry — coverage & accuracy

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 2.1 | Every counterparty we currently trade with is in `Registry → LPs`. | C | ☐ |
| 2.2 | Each LP's supported currencies, networks, and preferred-bank whitelist match the trading desk's reality. | C | ☐ |
| 2.3 | Tier and pricing tier are sane for ranking purposes. | C | ☐ |

## 3. Routing engine — recommendation correctness

Run a sample of real client profiles through `Routing` and confirm the engine
picks what the desk would pick. Suggested sample clients:

| # | Profile shape | Expected primary | Owner | ✓ |
|---|---------------|------------------|-------|---|
| 3.1 | LOW-risk, USD-only, US entity, FEDWIRE requested | Customers Bank, CUBIX upgrade visible | C | ☐ |
| 3.2 | LOW-risk, EUR/GBP, EU entity, SEPA / FASTER_PAYMENTS | Openpayd or Equals Money | C | ☐ |
| 3.3 | HIGH-risk, USD, BCB-eligible, SWIFT requested | BCB Group with HIGH-risk intra-bank hop through Openpayd / Equals | J | ☐ |
| 3.4 | LOW-risk, CAD, Neo eligible | Neo Financial | C | ☐ |
| 3.5 | Stables-in client (USDT/USDC), Ripple ODL eligible | Ripple ODL flow with stables feedstock | C | ☐ |
| 3.6 | Multi-leg client (USD + EUR + CAD) | Three separate cards, each with the correct bank per leg | C | ☐ |

## 4. Settlement Flow visualisation

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 4.1 | Buy / Sell toggle on each leg flips the chain correctly. | C / J | ☐ |
| 4.2 | LP step is clickable and the dropdown lists every eligible LP for that leg. | C | ☐ |
| 4.3 | Switching the LP updates the feedstock currency shown on the LP step. | C | ☐ |
| 4.4 | When the bank's accepted feedstock differs from the payout currency, the bank step shows `FX: X → Y` and is highlighted amber. | J | ☐ |
| 4.5 | A HIGH-risk client routed via BCB or Customers Bank shows the conditional intra-bank hop (Openpayd / Equals) on the SELL flow with a dashed border. | J | ☐ |
| 4.6 | The intra-bank step has a tooltip explaining the rerouting reason. | J | ☐ |
| 4.7 | LOW-risk clients on the same banks do **not** show the intra-bank hop. | J | ☐ |

## 5. Alternatives & overrides

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 5.1 | "Alternative Banks" list shows the correct fallbacks for each leg, ordered by score. | C | ☐ |
| 5.2 | Each alternative shows a sane match % (0 / 25 / 50 / 75 / 100). | C | ☐ |
| 5.3 | Clicking ⇌ Swap on an alternative makes it the active primary, the flow re-renders against that bank, and a Reset button appears. | C | ☐ |
| 5.4 | Reset returns to the engine's original primary. | C | ☐ |

## 6. Affinity rules (Layer 3)

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 6.1 | At least the named affinities the desk relies on are loaded (e.g. specific client → specific bank). | C | ☐ |
| 6.2 | An affinity rule actually overrides the score-based pick on the routing page when the matching client is loaded. | C | ☐ |
| 6.3 | Adding / editing / deleting an affinity from `Rules → Affinity` is reflected in the routing recommendation immediately. | E | ☐ |

## 7. Scoring weights

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 7.1 | All five default factors (network bonus, tier, settlement speed, pricing, priority) are visible on `Rules → Scoring Weights`. | C | ☐ |
| 7.2 | Editing a weight and saving changes the order of the alternatives list when relevant. | C | ☐ |
| 7.3 | Reset restores the documented defaults. | E | ☐ |

## 8. Client profile management

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 8.1 | Creating a client from `Registry → Clients` persists and shows up immediately on the routing page's client picker. | J | ☐ |
| 8.2 | Editing a client from the routing page (Save changes to ...) writes back to the database — confirmed by reload. | J | ☐ |
| 8.3 | Discard reverts unsaved edits to the loaded values. | J | ☐ |
| 8.4 | "Save as new client" works when no client is loaded. | J | ☐ |
| 8.5 | The `business_vertical` field is captured but is **not** changing routing output (reference only). | J | ☐ |

## 9. Audit trail

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 9.1 | Every routing computation produces an audit row (`Audit` page). | J | ☐ |
| 9.2 | The audit row has client, currency leg, recommended bank, recommended LP, and a timestamp. | J | ☐ |
| 9.3 | Manual overrides (swapping to an alternative) are flagged in the audit trail. | J | ☐ |

## 10. Operational readiness

| # | Check | Owner | ✓ |
|---|-------|-------|---|
| 10.1 | The site loads behind the password gate from a fresh browser. | E | ☐ |
| 10.2 | All 28 engine unit tests pass on `main`. | E | ☐ |
| 10.3 | Production build emits no console errors on the routing page. | E | ☐ |
| 10.4 | The Supabase project has RLS or equivalent guard rails on every table. | E | ☐ |
| 10.5 | Two named admins on the Vercel project. | E | ☐ |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Trading desk | Curtis | _______ | _______ |
| Middle office | Jim | _______ | _______ |
| Engineering | Jonah | _______ | _______ |

Once all rows above are ticked and the three signatures are collected, the
engine logic in `src/engine/routing.js` is considered locked for the Atlas
port. Any subsequent change to routing behaviour requires a fresh sign-off
pass on sections 3, 4, 6, and 7.
