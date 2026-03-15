-- Phase 1 modular economy extensions (new tables only)

CREATE TABLE IF NOT EXISTS public.treasury_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE DEFAULT 'platform_treasury',
  credit_balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_account_id uuid NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('fee_inflow', 'manual_transfer', 'prize_distribution', 'moderator_reward', 'event_funding')),
  amount integer NOT NULL CHECK (amount > 0),
  from_agent_id uuid REFERENCES public.agents(id),
  to_agent_id uuid REFERENCES public.agents(id),
  reference_type text,
  reference_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.land_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id text NOT NULL UNIQUE,
  owner_agent_id uuid REFERENCES public.agents(id),
  district text NOT NULL DEFAULT 'market' CHECK (district IN ('casino', 'market', 'research', 'entertainment')),
  plot_type text NOT NULL DEFAULT 'standard',
  price integer NOT NULL CHECK (price > 0),
  service_fee_bps integer NOT NULL DEFAULT 500 CHECK (service_fee_bps >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.land_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES public.land_plots(id) ON DELETE CASCADE,
  seller_agent_id uuid REFERENCES public.agents(id),
  buyer_agent_id uuid NOT NULL REFERENCES public.agents(id),
  sale_price integer NOT NULL CHECK (sale_price > 0),
  treasury_fee integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL UNIQUE,
  owner_agent_id uuid NOT NULL REFERENCES public.agents(id),
  price integer NOT NULL CHECK (price > 0),
  description text NOT NULL,
  category text NOT NULL,
  plot_id uuid REFERENCES public.land_plots(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.agent_services(id) ON DELETE CASCADE,
  buyer_agent_id uuid NOT NULL REFERENCES public.agents(id),
  seller_agent_id uuid NOT NULL REFERENCES public.agents(id),
  gross_amount integer NOT NULL CHECK (gross_amount > 0),
  treasury_fee integer NOT NULL,
  seller_amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.economy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  name text NOT NULL,
  entry_fee integer NOT NULL DEFAULT 0,
  prize_pool integer NOT NULL DEFAULT 0,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.event_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.economy_events(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id),
  entry_fee_paid integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, agent_id)
);

ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Treasury accounts readable by authenticated" ON public.treasury_accounts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Treasury tx readable by authenticated" ON public.treasury_transactions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Land plots readable by everyone" ON public.land_plots
FOR SELECT TO public USING (true);

CREATE POLICY "Land sales readable by everyone" ON public.land_sales
FOR SELECT TO public USING (true);

CREATE POLICY "Services readable by everyone" ON public.agent_services
FOR SELECT TO public USING (true);

CREATE POLICY "Service purchases readable by everyone" ON public.service_purchases
FOR SELECT TO public USING (true);

CREATE POLICY "Events readable by everyone" ON public.economy_events
FOR SELECT TO public USING (true);

CREATE POLICY "Event entries readable by everyone" ON public.event_entries
FOR SELECT TO public USING (true);

INSERT INTO public.treasury_accounts (name, credit_balance)
VALUES ('platform_treasury', 0)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_economy_admin_metrics()
RETURNS TABLE(
  treasury_credits bigint,
  total_credits_circulating bigint,
  total_withdrawn_credits bigint,
  daily_transactions bigint,
  credit_velocity numeric,
  daily_registrations bigint,
  largest_wallets jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH top_wallets AS (
    SELECT jsonb_agg(jsonb_build_object('agent_id', id, 'name', name, 'credit_balance', credit_balance) ORDER BY credit_balance DESC) AS wallets
    FROM (SELECT id, name, credit_balance FROM agents ORDER BY credit_balance DESC LIMIT 5) a
  )
  SELECT
    (SELECT COALESCE(SUM(credit_balance), 0)::bigint FROM treasury_accounts),
    (SELECT COALESCE(SUM(credit_balance), 0)::bigint FROM agents),
    (SELECT COALESCE(SUM(credits), 0)::bigint FROM credit_cashouts WHERE status = 'approved'),
    (
      (SELECT COUNT(*) FROM credit_transactions WHERE created_at >= now() - interval '24 hours') +
      (SELECT COUNT(*) FROM service_purchases WHERE created_at >= now() - interval '24 hours') +
      (SELECT COUNT(*) FROM land_sales WHERE created_at >= now() - interval '24 hours')
    )::bigint,
    COALESCE(
      (
        (
          (SELECT COUNT(*) FROM credit_transactions WHERE created_at >= now() - interval '24 hours') +
          (SELECT COUNT(*) FROM service_purchases WHERE created_at >= now() - interval '24 hours') +
          (SELECT COUNT(*) FROM land_sales WHERE created_at >= now() - interval '24 hours')
        )::numeric /
        NULLIF((SELECT SUM(credit_balance)::numeric FROM agents), 0)
      ),
      0
    )::numeric,
    (SELECT COUNT(*)::bigint FROM agents WHERE created_at >= date_trunc('day', now())),
    (SELECT COALESCE(wallets, '[]'::jsonb) FROM top_wallets);
$$;
