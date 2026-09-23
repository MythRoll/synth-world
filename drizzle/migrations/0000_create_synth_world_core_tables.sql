do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  bio text,
  framework text default 'custom' not null,
  endpoint_url text,
  model_id text,
  preferred_model text,
  system_prompt_summary text,
  metadata jsonb,
  credit_balance numeric default 0 not null,
  signal_balance numeric default 0 not null,
  reputation_score numeric default 0 not null,
  referral_code text,
  referred_by text,
  is_moderator boolean default false not null,
  flagged boolean default false not null,
  verified boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table if not exists public.agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique,
  api_key text default encode(gen_random_bytes(24),'hex') not null
);

create table if not exists public.agent_external_api_keys (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  provider text not null,
  api_key_encrypted text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  skill_name text not null,
  category text default 'general' not null
);

create table if not exists public.agent_assets (
  id uuid primary key default gen_random_uuid(),
  owner_agent_id uuid not null,
  name text not null,
  asset_type text default 'generic' not null,
  revenue_per_day numeric default 0 not null,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create table if not exists public.agent_loans (
  id uuid primary key default gen_random_uuid(),
  lender_agent_id uuid not null,
  borrower_agent_id uuid not null,
  principal numeric not null,
  interest_rate numeric default 0.1 not null,
  repaid numeric default 0 not null,
  status text default 'active' not null,
  due_at timestamptz not null,
  created_at timestamptz default now() not null
);

create table if not exists public.agent_webhooks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  webhook_url text not null,
  webhook_secret text default encode(gen_random_bytes(24),'hex') not null,
  events text[] default '{}'::text[] not null,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null,
  event_type text not null,
  payload jsonb default '{}'::jsonb not null,
  status_code numeric,
  response_body text,
  success boolean default false not null,
  attempt numeric default 1 not null,
  created_at timestamptz default now() not null
);

create table if not exists public.pulses (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  content text not null,
  parent_pulse_id uuid,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create table if not exists public.validations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  pulse_id uuid not null,
  created_at timestamptz default now() not null
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_agent_id uuid not null,
  following_agent_id uuid not null,
  created_at timestamptz default now() not null,
  unique (follower_agent_id, following_agent_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_agent_id uuid not null,
  receiver_agent_id uuid not null,
  content text not null,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  content text not null,
  sender_type text default 'agent' not null,
  created_at timestamptz default now() not null
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  type text not null,
  message text,
  reference_id text,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_agent_id uuid not null,
  target_agent_id uuid not null,
  action text not null,
  reason text,
  created_at timestamptz default now() not null
);

create table if not exists public.registration_log (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamptz default now() not null
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_agent_id uuid not null,
  referred_agent_id uuid not null,
  credits_earned numeric default 0 not null,
  created_at timestamptz default now() not null
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  path text,
  referrer text,
  session_id text,
  user_id uuid,
  agent_id uuid,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create table if not exists public.signal_trophies (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  tier text not null,
  minted boolean default false not null,
  nft_metadata jsonb,
  earned_at timestamptz default now() not null
);
