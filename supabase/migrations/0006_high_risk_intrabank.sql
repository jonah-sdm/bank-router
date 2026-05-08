-- Phase B follow-up: BCB Group and Customers Bank now accept HIGH-risk
-- clients, contingent on the intra-bank transit through Openpayd / Equals
-- Money on the SELL flow. Without this, the engine excludes both banks for
-- HIGH-risk clients and the conditional intra-bank step in the Settlement
-- Flow visual never displays.
--
-- The hop logic itself lives in src/engine/routing.js (buildSettlementFlow):
-- it auto-injects the Openpayd / Equals transit step on SELL when
-- profile.risk_rating === 'HIGH' and the routed bank is BCB or Customers.

update banks
   set max_client_risk = 'HIGH',
       notes = 'USD domestic ONLY. Best pricing for USD. Cubix = instant/free. HIGH-risk clients accepted with intra-bank transit through Openpayd/Equals to avoid source-bank flagging.'
 where bank_name = 'Customers Bank';

update banks
   set max_client_risk = 'HIGH',
       notes = 'Multi-currency. Blink = near-instant/free via Nonco/Flowdesk. HIGH-risk clients accepted with intra-bank transit through Openpayd/Equals to avoid source-bank flagging.'
 where bank_name = 'BCB Group';
