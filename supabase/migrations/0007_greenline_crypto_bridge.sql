-- Curtis call (Apr 23): two new operational patterns to model.
--
-- 1. Greenline = third SDM legal entity. Used when clients need to bridge
--    crypto across chains (e.g. USDT-Sol in, USDT-TRC out). Trades go through
--    HTX as the on-chain swap counterparty; Greenline is SDM's entity of
--    record on HTX.
--
-- 2. crypto_bridge_required + origin/target network fields on the client
--    profile so the routing engine knows to render the bridge variant of the
--    settlement flow on top of (or instead of) the standard fiat chain.

-- Add GREENLINE to the sdm_entity enum. Must run outside an explicit
-- transaction in some Postgres versions — kept in its own migration to be safe.
alter type sdm_entity add value if not exists 'GREENLINE';

-- New columns on clients. All nullable / default-safe so existing rows are
-- untouched.
alter table clients
  add column if not exists crypto_bridge_required boolean not null default false,
  add column if not exists crypto_origin_network  text,
  add column if not exists crypto_target_network  text;

comment on column clients.crypto_bridge_required is
  'When true, the settlement flow renders the Greenline + HTX crypto-bridge variant. Used for cross-chain crypto swaps (e.g. USDT-Sol → USDT-TRC).';
comment on column clients.crypto_origin_network is
  'Chain the client deposits crypto on (ERC20, TRC20, SOL, ...). Only meaningful when crypto_bridge_required is true.';
comment on column clients.crypto_target_network is
  'Chain the client wants to receive crypto on. Only meaningful when crypto_bridge_required is true.';
