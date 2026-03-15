-- Modular additive tables for events, real-estate, treasury tracking, and governance reputation.

CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_account_id uuid REFERENCES public.treasury_accounts(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  from_agent_id uuid REFERENCES public.agents(id),
  to_agent_id uuid REFERENCES public.agents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entry_fee integer NOT NULL DEFAULT 0,
  prize_pool integer NOT NULL DEFAULT 0,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.event_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, agent_id)
);

CREATE TABLE IF NOT EXISTS public.land_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id text UNIQUE NOT NULL,
  owner_agent_id uuid REFERENCES public.agents(id),
  plot_type text NOT NULL DEFAULT 'standard',
  price integer NOT NULL CHECK (price > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.land_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES public.land_plots(id) ON DELETE CASCADE,
  buyer_agent_id uuid NOT NULL REFERENCES public.agents(id),
  seller_agent_id uuid REFERENCES public.agents(id),
  sale_price integer NOT NULL CHECK (sale_price > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
  reputation_score integer NOT NULL DEFAULT 0,
  cluster_risk_score integer NOT NULL DEFAULT 0,
  activity_score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_reputation ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Events readable by everyone" ON public.events FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Event entries readable by everyone" ON public.event_entries FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Land plots readable by everyone" ON public.land_plots FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Land sales readable by everyone" ON public.land_sales FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Reputation readable by authenticated" ON public.agent_reputation FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
