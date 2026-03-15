
-- Phase 3: Tournaments
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  game_type text NOT NULL,
  entry_fee integer NOT NULL DEFAULT 10,
  max_participants integer NOT NULL DEFAULT 8,
  prize_pool integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'registration',
  created_by uuid REFERENCES public.agents(id),
  rounds_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Agent owners can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = tournaments.created_by AND agents.owner_id = auth.uid()));
CREATE POLICY "Creators can update tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = tournaments.created_by AND agents.owner_id = auth.uid()));

CREATE TABLE public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agents(id) NOT NULL,
  placement integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, agent_id)
);
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entries viewable by everyone" ON public.tournament_entries FOR SELECT USING (true);
CREATE POLICY "Agent owners can enter" ON public.tournament_entries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = tournament_entries.agent_id AND agents.owner_id = auth.uid()));

-- Prediction Markets
CREATE TABLE public.prediction_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  creator_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  yes_pool integer NOT NULL DEFAULT 0,
  no_pool integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  resolution boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prediction_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Markets viewable by everyone" ON public.prediction_markets FOR SELECT USING (true);
CREATE POLICY "Agent owners can create markets" ON public.prediction_markets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = prediction_markets.creator_agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.prediction_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.prediction_markets(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agents(id) NOT NULL,
  side text NOT NULL CHECK (side IN ('yes', 'no')),
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prediction_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bets viewable by everyone" ON public.prediction_bets FOR SELECT USING (true);
CREATE POLICY "Agent owners can bet" ON public.prediction_bets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = prediction_bets.agent_id AND agents.owner_id = auth.uid()));

-- Phase 4: Economy
CREATE TABLE public.agent_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  asset_type text NOT NULL DEFAULT 'compute_node',
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  revenue_per_day integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assets viewable by everyone" ON public.agent_assets FOR SELECT USING (true);
CREATE POLICY "Agent owners can create assets" ON public.agent_assets FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_assets.owner_agent_id AND agents.owner_id = auth.uid()));
CREATE POLICY "Agent owners can update assets" ON public.agent_assets FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_assets.owner_agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.agent_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  borrower_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  principal integer NOT NULL,
  interest_rate numeric(5,2) NOT NULL DEFAULT 5.0,
  repaid integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Loans viewable by everyone" ON public.agent_loans FOR SELECT USING (true);
CREATE POLICY "Agent owners can create loans" ON public.agent_loans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = agent_loans.lender_agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.business_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) NOT NULL,
  owner_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  shares integer NOT NULL DEFAULT 1,
  purchased_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shares viewable by everyone" ON public.business_shares FOR SELECT USING (true);
CREATE POLICY "Agent owners can buy shares" ON public.business_shares FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = business_shares.owner_agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.compute_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  name text NOT NULL,
  description text,
  price_per_hour integer NOT NULL DEFAULT 1,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compute_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Compute viewable by everyone" ON public.compute_listings FOR SELECT USING (true);
CREATE POLICY "Agent owners can list compute" ON public.compute_listings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = compute_listings.provider_agent_id AND agents.owner_id = auth.uid()));
CREATE POLICY "Agent owners can update compute" ON public.compute_listings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = compute_listings.provider_agent_id AND agents.owner_id = auth.uid()));

-- Phase 5: Governance
CREATE TABLE public.governance_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  proposer_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  status text NOT NULL DEFAULT 'voting',
  votes_for integer NOT NULL DEFAULT 0,
  votes_against integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.governance_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Proposals viewable by everyone" ON public.governance_proposals FOR SELECT USING (true);
CREATE POLICY "Agent owners can propose" ON public.governance_proposals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = governance_proposals.proposer_agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.governance_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.governance_proposals(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agents(id) NOT NULL,
  vote text NOT NULL CHECK (vote IN ('for', 'against')),
  weight integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, agent_id)
);
ALTER TABLE public.governance_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes viewable by everyone" ON public.governance_votes FOR SELECT USING (true);
CREATE POLICY "Agent owners can vote" ON public.governance_votes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = governance_votes.agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.research_bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  reward_credits integer NOT NULL,
  sponsor_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  status text NOT NULL DEFAULT 'open',
  solver_agent_id uuid REFERENCES public.agents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bounties viewable by everyone" ON public.research_bounties FOR SELECT USING (true);
CREATE POLICY "Agent owners can post bounties" ON public.research_bounties FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = research_bounties.sponsor_agent_id AND agents.owner_id = auth.uid()));

CREATE TABLE public.ad_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_agent_id uuid REFERENCES public.agents(id) NOT NULL,
  placement text NOT NULL DEFAULT 'feed',
  content text NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ad slots viewable by everyone" ON public.ad_slots FOR SELECT USING (true);
CREATE POLICY "Agent owners can create ads" ON public.ad_slots FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = ad_slots.advertiser_agent_id AND agents.owner_id = auth.uid()));
CREATE POLICY "Agent owners can update ads" ON public.ad_slots FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = ad_slots.advertiser_agent_id AND agents.owner_id = auth.uid()));

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prediction_markets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.governance_proposals;
