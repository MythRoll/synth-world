create table if not exists public.game_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game_type text not null,
  status text default 'waiting' not null,
  min_stake numeric default 20 not null,
  max_players numeric default 6 not null,
  rake_percent numeric default 5 not null,
  created_by text,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null,
  agent_id uuid not null,
  stake numeric not null,
  status text default 'active' not null,
  metadata jsonb,
  joined_at timestamptz default now() not null,
  unique (table_id, agent_id)
);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null,
  round_number numeric default 1 not null,
  round_data jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game_type text not null,
  entry_fee numeric default 0 not null,
  prize_pool numeric default 0 not null,
  max_participants numeric default 16 not null,
  status text default 'open' not null,
  rounds_data jsonb,
  created_by text,
  created_at timestamptz default now() not null
);

create table if not exists public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  agent_id uuid not null,
  placement numeric,
  created_at timestamptz default now() not null
);

create table if not exists public.prediction_markets (
  id uuid primary key default gen_random_uuid(),
  creator_agent_id uuid not null,
  question text not null,
  yes_pool numeric default 0 not null,
  no_pool numeric default 0 not null,
  status text default 'open' not null,
  resolution boolean,
  created_at timestamptz default now() not null
);

create table if not exists public.prediction_bets (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null,
  agent_id uuid not null,
  side text not null,
  amount numeric not null,
  created_at timestamptz default now() not null
);

create table if not exists public.governance_proposals (
  id uuid primary key default gen_random_uuid(),
  proposer_agent_id uuid not null,
  title text not null,
  description text,
  status text default 'open' not null,
  votes_for numeric default 0 not null,
  votes_against numeric default 0 not null,
  closes_at timestamptz default (now() + interval '3 days') not null,
  created_at timestamptz default now() not null
);

create table if not exists public.governance_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  agent_id uuid not null,
  vote text not null,
  weight numeric default 1 not null,
  created_at timestamptz default now() not null,
  unique (proposal_id, agent_id)
);

create table if not exists public.land_plots (
  id uuid primary key default gen_random_uuid(),
  plot_id text not null unique,
  district text default 'downtown' not null,
  price numeric default 100 not null,
  owner_agent_id uuid,
  created_at timestamptz default now() not null
);

create table if not exists public.land_sales (
  id uuid primary key default gen_random_uuid(),
  plot_id text not null,
  buyer_agent_id uuid not null,
  seller_agent_id uuid,
  sale_price numeric not null,
  treasury_fee numeric default 0 not null,
  created_at timestamptz default now() not null
);
