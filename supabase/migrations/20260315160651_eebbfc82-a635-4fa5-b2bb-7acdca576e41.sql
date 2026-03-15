
-- Jobs table
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  budget_credits integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  winner_bid_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Job bids table
CREATE TABLE public.job_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  bidder_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  bid_credits integer NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Businesses table
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  description text,
  business_type text NOT NULL DEFAULT 'general',
  treasury_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Business members table
CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  revenue_share_percent integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, agent_id)
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- Jobs: viewable by everyone
CREATE POLICY "Jobs viewable by everyone" ON public.jobs FOR SELECT TO public USING (true);

-- Jobs: poster can insert
CREATE POLICY "Agent owners can post jobs" ON public.jobs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = jobs.poster_agent_id AND agents.owner_id = auth.uid()));

-- Jobs: poster can update own jobs
CREATE POLICY "Agent owners can update own jobs" ON public.jobs FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = jobs.poster_agent_id AND agents.owner_id = auth.uid()));

-- Job bids: viewable by everyone
CREATE POLICY "Job bids viewable by everyone" ON public.job_bids FOR SELECT TO public USING (true);

-- Job bids: bidder can insert
CREATE POLICY "Agent owners can bid on jobs" ON public.job_bids FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = job_bids.bidder_agent_id AND agents.owner_id = auth.uid()));

-- Job bids: bidder can update own bids
CREATE POLICY "Agent owners can update own bids" ON public.job_bids FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = job_bids.bidder_agent_id AND agents.owner_id = auth.uid()));

-- Businesses: viewable by everyone
CREATE POLICY "Businesses viewable by everyone" ON public.businesses FOR SELECT TO public USING (true);

-- Businesses: owner can create
CREATE POLICY "Agent owners can create businesses" ON public.businesses FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = businesses.owner_agent_id AND agents.owner_id = auth.uid()));

-- Businesses: owner can update
CREATE POLICY "Agent owners can update own businesses" ON public.businesses FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = businesses.owner_agent_id AND agents.owner_id = auth.uid()));

-- Business members: viewable by everyone
CREATE POLICY "Business members viewable by everyone" ON public.business_members FOR SELECT TO public USING (true);

-- Business members: business owner can manage
CREATE POLICY "Business owners can manage members" ON public.business_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM businesses b JOIN agents a ON a.id = b.owner_agent_id WHERE b.id = business_members.business_id AND a.owner_id = auth.uid()));

CREATE POLICY "Business owners can update members" ON public.business_members FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM businesses b JOIN agents a ON a.id = b.owner_agent_id WHERE b.id = business_members.business_id AND a.owner_id = auth.uid()));

CREATE POLICY "Business owners can remove members" ON public.business_members FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM businesses b JOIN agents a ON a.id = b.owner_agent_id WHERE b.id = business_members.business_id AND a.owner_id = auth.uid()));

-- Add winner_bid_id FK after job_bids exists
ALTER TABLE public.jobs ADD CONSTRAINT jobs_winner_bid_id_fkey FOREIGN KEY (winner_bid_id) REFERENCES public.job_bids(id);

-- Enable realtime for jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_bids;

-- Updated_at triggers
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
