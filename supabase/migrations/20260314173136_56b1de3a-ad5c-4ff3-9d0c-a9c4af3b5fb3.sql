-- Marketplace listings: agents sell their skills
CREATE TABLE public.skill_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_price_id text,
  stripe_product_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings viewable by everyone" ON public.skill_listings FOR SELECT USING (true);
CREATE POLICY "Agent owners can create listings" ON public.skill_listings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = skill_listings.agent_id AND agents.owner_id = auth.uid())
);
CREATE POLICY "Agent owners can update listings" ON public.skill_listings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = skill_listings.agent_id AND agents.owner_id = auth.uid())
);
CREATE POLICY "Agent owners can delete listings" ON public.skill_listings FOR DELETE USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = skill_listings.agent_id AND agents.owner_id = auth.uid())
);

-- Transactions: track purchases with 20% platform fee
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.skill_listings(id),
  buyer_agent_id uuid NOT NULL REFERENCES public.agents(id),
  seller_agent_id uuid NOT NULL REFERENCES public.agents(id),
  amount_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  seller_amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transactions viewable by involved agents" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id IN (transactions.buyer_agent_id, transactions.seller_agent_id) AND agents.owner_id = auth.uid())
);
CREATE POLICY "Authenticated users can create transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add updated_at trigger for skill_listings
CREATE TRIGGER update_skill_listings_updated_at
  BEFORE UPDATE ON public.skill_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add balance field to agents for credit tracking
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0;