-- =====================================================================
-- SDM Atlas Routing Engine — Initial Schema
-- =====================================================================
-- Tables: banks, lps, clients, routing_assignments, scoring_weights, audit_log
-- Enums: sdm_entity, risk_rating, settlement_network, pricing_tier, ...
-- Triggers: auto-populate audit_log on INSERT/UPDATE/DELETE
-- RLS: enabled on all tables (policies in 0002_rls.sql)
-- =====================================================================

-- --------------------------- Enums ---------------------------

create type sdm_entity as enum ('SDM_INC', 'SDM_USA', 'BOTH');
create type entity_type as enum ('INDIVIDUAL', 'CORPORATION');
create type risk_rating as enum ('LOW', 'MEDIUM', 'HIGH');
create type kyc_status as enum ('PENDING', 'APPROVED', 'EDD_REQUIRED');
create type settlement_network as enum ('FEDWIRE', 'SWIFT', 'EFT', 'BLINK', 'CUBIX', 'RIPPLE_ODL', 'CRYPTO');
create type settlement_speed as enum ('INSTANT', 'SAME_DAY', 'T1', 'T2');
create type settlement_sla as enum ('T0_SAME_DAY', 'T1_NEXT_DAY', 'T2_TWO_DAY');
create type pricing_tier as enum ('BEST', 'COMPETITIVE', 'STANDARD', 'PREMIUM');
create type bank_tier as enum ('T1', 'T2', 'T3', 'T2_SPECIALIST', 'T1_CAD', 'T3_DEDICATED');
create type priority_tier as enum ('P1', 'P2', 'P3');
create type confidence as enum ('HIGH', 'MEDIUM', 'LOW');

-- --------------------------- banks ---------------------------

create table banks (
  bank_id              uuid primary key default gen_random_uuid(),
  bank_name            text not null unique,
  tier                 bank_tier not null,
  sdm_entity           sdm_entity not null,
  supported_currencies text[] not null default '{}',             -- payout / settle-to-client
  accepts_lp_currencies text[] not null default '{}',            -- feedstock accepted from LPs
  settlement_networks  settlement_network[] not null default '{}',
  max_client_risk      risk_rating not null,
  accepts_individuals  boolean not null default true,
  accepted_verticals   text[],                    -- null = all
  blocked_verticals    text[] not null default '{}',
  pricing_tier         pricing_tier not null,
  settlement_speed     settlement_speed not null,
  notes                text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index banks_active_idx on banks(is_active) where is_active;
create index banks_entity_idx on banks(sdm_entity);

-- --------------------------- lps ---------------------------

create table lps (
  lp_id                uuid primary key default gen_random_uuid(),
  lp_name              text not null unique,
  supported_currencies text[] not null default '{}',
  settlement_networks  settlement_network[] not null default '{}',
  preferred_banks      uuid[] not null default '{}',  -- array of bank_id
  risk_tolerance       risk_rating not null default 'MEDIUM',
  notes                text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index lps_active_idx on lps(is_active) where is_active;

-- --------------------------- clients ---------------------------

create table clients (
  client_id             uuid primary key default gen_random_uuid(),
  copper_id             text unique,                    -- external Copper CRM ID
  client_name           text not null,
  entity_type           entity_type not null,
  business_vertical     text not null,                  -- enum managed in app
  jurisdiction_country  text not null,                  -- ISO 3166-1 alpha-2
  jurisdiction_state    text,
  sdm_entity            sdm_entity not null,
  risk_rating           risk_rating not null,
  kyc_status            kyc_status not null default 'PENDING',
  currencies_traded     text[] not null default '{}',
  settlement_currencies text[] not null default '{}',
  settlement_methods    settlement_network[] not null default '{}',
  settlement_speed_sla  settlement_sla not null default 'T1_NEXT_DAY',
  beneficiary_country   text,
  uses_stablecoins      boolean not null default false,
  priority_tier         priority_tier not null default 'P2',
  monthly_volume_usd    numeric,
  monthly_revenue_usd   numeric,
  referral_network      boolean not null default false,
  fee_bps               integer,
  notes                 text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index clients_entity_idx on clients(sdm_entity);
create index clients_risk_idx on clients(risk_rating);

-- --------------------------- routing_assignments ---------------------------

create table routing_assignments (
  assignment_id        uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(client_id) on delete cascade,
  currency             text not null,
  recommended_bank_id  uuid references banks(bank_id),
  settlement_network   settlement_network,
  fallback_bank_id     uuid references banks(bank_id),
  lp_ids               uuid[] not null default '{}',
  confidence           confidence not null default 'MEDIUM',
  is_manual_override   boolean not null default false,
  override_reason      text,
  assigned_by          uuid,                         -- references auth.users(id) — no FK to keep migrations portable
  assigned_at          timestamptz not null default now(),
  exclusion_log        jsonb not null default '[]'
);

create index routing_assignments_client_idx on routing_assignments(client_id);
create unique index routing_assignments_client_currency_idx on routing_assignments(client_id, currency);

-- --------------------------- scoring_weights ---------------------------
-- Single-row table holding current weights. Phase 1: normalized to 100.

create table scoring_weights (
  id                        integer primary key default 1 check (id = 1),
  tier_weight               integer not null default 30 check (tier_weight between 0 and 100),
  settlement_speed_weight   integer not null default 25 check (settlement_speed_weight between 0 and 100),
  pricing_weight            integer not null default 20 check (pricing_weight between 0 and 100),
  network_bonus_weight      integer not null default 15 check (network_bonus_weight between 0 and 100),
  priority_bonus_weight     integer not null default 10 check (priority_bonus_weight between 0 and 100),
  updated_at                timestamptz not null default now(),
  updated_by                uuid
);

insert into scoring_weights (id) values (1);

-- --------------------------- audit_log ---------------------------

create table audit_log (
  audit_id     uuid primary key default gen_random_uuid(),
  table_name   text not null,
  record_id    text not null,                 -- PK as text for portability across tables
  action       text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_values   jsonb,
  new_values   jsonb,
  changed_by   uuid,
  changed_at   timestamptz not null default now()
);

create index audit_log_table_record_idx on audit_log(table_name, record_id);
create index audit_log_changed_at_idx on audit_log(changed_at desc);

-- --------------------------- audit trigger function ---------------------------

create or replace function log_audit()
returns trigger
language plpgsql
security definer
as $$
declare
  actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  pk_col text;
  pk_val text;
begin
  -- Derive primary key column name by convention: <table>_id OR id
  pk_col := tg_argv[0];
  if pk_col is null then
    pk_col := tg_table_name || '_id';
  end if;

  if tg_op = 'DELETE' then
    execute format('select ($1).%I::text', pk_col) into pk_val using old;
    insert into audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    values (tg_table_name, pk_val, 'DELETE', to_jsonb(old), null, actor);
    return old;
  elsif tg_op = 'UPDATE' then
    execute format('select ($1).%I::text', pk_col) into pk_val using new;
    insert into audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    values (tg_table_name, pk_val, 'UPDATE', to_jsonb(old), to_jsonb(new), actor);
    return new;
  else
    execute format('select ($1).%I::text', pk_col) into pk_val using new;
    insert into audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    values (tg_table_name, pk_val, 'INSERT', null, to_jsonb(new), actor);
    return new;
  end if;
end;
$$;

-- --------------------------- updated_at trigger ---------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- attach triggers
create trigger banks_audit
  after insert or update or delete on banks
  for each row execute function log_audit('bank_id');
create trigger banks_touch
  before update on banks
  for each row execute function touch_updated_at();

create trigger lps_audit
  after insert or update or delete on lps
  for each row execute function log_audit('lp_id');
create trigger lps_touch
  before update on lps
  for each row execute function touch_updated_at();

create trigger clients_audit
  after insert or update or delete on clients
  for each row execute function log_audit('client_id');
create trigger clients_touch
  before update on clients
  for each row execute function touch_updated_at();

create trigger routing_assignments_audit
  after insert or update or delete on routing_assignments
  for each row execute function log_audit('assignment_id');

create trigger scoring_weights_audit
  after insert or update or delete on scoring_weights
  for each row execute function log_audit('id');

-- --------------------------- enable RLS ---------------------------

alter table banks                enable row level security;
alter table lps                  enable row level security;
alter table clients              enable row level security;
alter table routing_assignments  enable row level security;
alter table scoring_weights      enable row level security;
alter table audit_log            enable row level security;

-- Permissive policies for Phase 1 (authenticated users = full access).
-- Refine to ops/admin roles in 0003_rls_roles.sql when auth is wired.
create policy "authenticated read banks" on banks for select to authenticated using (true);
create policy "authenticated write banks" on banks for all to authenticated using (true) with check (true);

create policy "authenticated read lps" on lps for select to authenticated using (true);
create policy "authenticated write lps" on lps for all to authenticated using (true) with check (true);

create policy "authenticated read clients" on clients for select to authenticated using (true);
create policy "authenticated write clients" on clients for all to authenticated using (true) with check (true);

create policy "authenticated read routing" on routing_assignments for select to authenticated using (true);
create policy "authenticated write routing" on routing_assignments for all to authenticated using (true) with check (true);

create policy "authenticated read weights" on scoring_weights for select to authenticated using (true);
create policy "authenticated write weights" on scoring_weights for all to authenticated using (true) with check (true);

create policy "authenticated read audit" on audit_log for select to authenticated using (true);

-- Phase 1 dev convenience: allow anon reads too (remove before prod)
create policy "anon read banks" on banks for select to anon using (true);
create policy "anon read lps" on lps for select to anon using (true);
create policy "anon read clients" on clients for select to anon using (true);
create policy "anon read routing" on routing_assignments for select to anon using (true);
create policy "anon read weights" on scoring_weights for select to anon using (true);
create policy "anon write banks" on banks for all to anon using (true) with check (true);
create policy "anon write lps" on lps for all to anon using (true) with check (true);
create policy "anon write clients" on clients for all to anon using (true) with check (true);
create policy "anon write routing" on routing_assignments for all to anon using (true) with check (true);
create policy "anon write weights" on scoring_weights for all to anon using (true) with check (true);
