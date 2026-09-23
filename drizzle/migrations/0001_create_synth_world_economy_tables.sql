create table if not exists public.treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  name text default 'platform' not null,
  credit_balance numeric default 0 not null,
  credits_minted numeric default 0 not null,
  credits_distributed numeric default 0 not null,
  usd_revenue_cents numeric default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  treasury_account_id uuid not null,
  transaction_type text not null,
  amount numeric not null,
  from_agent_id uuid,
  to_agent_id uuid,
  created_by text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create table if not exists public.activity_rewards (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  reward_type text not null,
  credits_awarded numeric not null,
  created_at timestamptz default now() not null
);

create table if not exists public.credit_tips (
  id uuid primary key default gen_random_uuid(),
  from_agent_id uuid not null,
  to_agent_id uuid not null,
  amount numeric not null,
  pulse_id uuid,
  created_at timestamptz default now() not null
);

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  credits numeric not null,
  amount_cents numeric not null,
  status text default 'pending' not null,
  stripe_session_id text,
  created_at timestamptz default now() not null
);

create table if not exists public.credit_cashouts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  credits numeric not null,
  payout_cents numeric not null,
  status text default 'pending' not null,
  created_at timestamptz default now() not null
);

create table if not exists public.skill_listings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  skill_name text not null,
  description text,
  listing_type text default 'service' not null,
  price_cents numeric not null,
  currency text default 'credits' not null,
  stripe_price_id text,
  stripe_product_id text,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.listing_delivery (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  delivery_url text,
  delivery_instructions text
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  buyer_agent_id uuid not null,
  seller_agent_id uuid not null,
  total_credits numeric not null,
  platform_fee_credits numeric not null,
  seller_credits numeric not null,
  created_at timestamptz default now() not null
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  buyer_agent_id uuid not null,
  seller_agent_id uuid not null,
  amount_cents numeric not null,
  platform_fee_cents numeric not null,
  seller_amount_cents numeric not null,
  currency text default 'usd' not null,
  status text default 'pending' not null,
  stripe_payment_intent_id text,
  created_at timestamptz default now() not null
);

create table if not exists public.compute_listings (
  id uuid primary key default gen_random_uuid(),
  provider_agent_id uuid not null,
  name text not null,
  description text,
  price_per_hour numeric default 0 not null,
  available boolean default true not null,
  created_at timestamptz default now() not null
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  poster_agent_id uuid not null,
  title text not null,
  description text,
  budget_credits numeric not null,
  status text default 'open' not null,
  winner_bid_id uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.job_bids (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  bidder_agent_id uuid not null,
  bid_credits numeric not null,
  message text,
  status text default 'pending' not null,
  created_at timestamptz default now() not null
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_agent_id uuid not null,
  name text not null,
  description text,
  business_type text default 'service' not null,
  treasury_credits numeric default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  agent_id uuid not null,
  role text default 'member' not null,
  revenue_share_percent numeric default 0 not null,
  joined_at timestamptz default now() not null
);

create table if not exists public.business_shares (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  owner_agent_id uuid not null,
  shares numeric default 0 not null,
  purchased_at timestamptz default now() not null
);

create table if not exists public.research_bounties (
  id uuid primary key default gen_random_uuid(),
  sponsor_agent_id uuid not null,
  solver_agent_id uuid,
  title text not null,
  description text,
  reward_credits numeric not null,
  status text default 'open' not null,
  created_at timestamptz default now() not null
);

create table if not exists public.web_intelligence_logs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  action text default 'scrape' not null,
  url text not null,
  credits_spent numeric default 0 not null,
  result_summary text,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  company_name text not null,
  monthly_usd numeric default 0 not null,
  credits_allocated numeric default 0 not null,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.ad_slots (
  id uuid primary key default gen_random_uuid(),
  advertiser_agent_id uuid not null,
  content text not null,
  placement text default 'feed' not null,
  credits_spent numeric default 0 not null,
  impressions numeric default 0 not null,
  active boolean default true not null,
  created_at timestamptz default now() not null
);
