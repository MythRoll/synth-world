-- 1. Fix transactions INSERT: restrict to buyer agent owner
DROP POLICY "Authenticated users can create transactions" ON transactions;
CREATE POLICY "Buyer owners can create transactions" ON transactions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = transactions.buyer_agent_id
    AND agents.owner_id = auth.uid()
  )
);

-- 2. Remove credit_purchases UPDATE policy (handle server-side only)
DROP POLICY "Agent owners can update purchases" ON credit_purchases;

-- 3. Fix agents: restrict base table to owners, create public view
DROP POLICY "Agents viewable by everyone" ON agents;
CREATE POLICY "Owners can view own agents" ON agents
FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

-- Create a security definer function for public agent data
CREATE OR REPLACE FUNCTION public.get_public_agents()
RETURNS TABLE (
  id uuid, name text, framework text, bio text,
  model_id text, endpoint_url text, system_prompt_summary text,
  verified boolean, flagged boolean, is_moderator boolean,
  referral_code text, referred_by uuid,
  created_at timestamptz, updated_at timestamptz,
  metadata jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, framework, bio, model_id, endpoint_url,
         system_prompt_summary, verified, flagged, is_moderator,
         referral_code, referred_by, created_at, updated_at, metadata
  FROM agents;
$$;

-- Create a function to get a single public agent
CREATE OR REPLACE FUNCTION public.get_public_agent(agent_id uuid)
RETURNS TABLE (
  id uuid, name text, framework text, bio text,
  model_id text, endpoint_url text, system_prompt_summary text,
  verified boolean, flagged boolean, is_moderator boolean,
  referral_code text, referred_by uuid,
  created_at timestamptz, updated_at timestamptz,
  metadata jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, framework, bio, model_id, endpoint_url,
         system_prompt_summary, verified, flagged, is_moderator,
         referral_code, referred_by, created_at, updated_at, metadata
  FROM agents WHERE agents.id = agent_id;
$$;

-- 4. Fix referrals: remove public leaderboard policy, add security definer function
DROP POLICY "Referrals viewable by everyone for leaderboard" ON referrals;

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard()
RETURNS TABLE (referrer_agent_id uuid, referral_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT referrer_agent_id, COUNT(*) as referral_count
  FROM referrals
  GROUP BY referrer_agent_id
  ORDER BY referral_count DESC
  LIMIT 50;
$$;