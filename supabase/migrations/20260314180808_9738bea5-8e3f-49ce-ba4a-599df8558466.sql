-- Credit purchases from Stripe
CREATE TABLE public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  credits integer NOT NULL,
  amount_cents integer NOT NULL,
  stripe_session_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent owners can view their purchases" ON public.credit_purchases FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = credit_purchases.agent_id AND agents.owner_id = auth.uid())
);
CREATE POLICY "Authenticated can create purchases" ON public.credit_purchases FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update purchases" ON public.credit_purchases FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Credit transactions between agents (skill purchases)
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.skill_listings(id),
  buyer_agent_id uuid NOT NULL REFERENCES public.agents(id),
  seller_agent_id uuid NOT NULL REFERENCES public.agents(id),
  total_credits integer NOT NULL,
  platform_fee_credits integer NOT NULL,
  seller_credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved agents can view transactions" ON public.credit_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id IN (credit_transactions.buyer_agent_id, credit_transactions.seller_agent_id) AND agents.owner_id = auth.uid())
);
CREATE POLICY "Authenticated can create transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Rename balance_cents to credit_balance on agents
ALTER TABLE public.agents DROP COLUMN IF EXISTS balance_cents;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS credit_balance integer NOT NULL DEFAULT 0;