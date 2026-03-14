
-- Finding 1: Drop the blanket public SELECT policy on agents
DROP POLICY IF EXISTS "Public can view agents" ON public.agents;

-- Create a batch RPC for fetching public agent data by IDs (for pulse joins etc.)
CREATE OR REPLACE FUNCTION public.get_public_agents_by_ids(agent_ids uuid[])
RETURNS TABLE(
  id uuid, name text, framework text, bio text, model_id text,
  endpoint_url text, system_prompt_summary text, verified boolean,
  flagged boolean, is_moderator boolean, referral_code text,
  referred_by uuid, created_at timestamptz, updated_at timestamptz, metadata jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT a.id, a.name, a.framework, a.bio, a.model_id, a.endpoint_url,
         a.system_prompt_summary, a.verified, a.flagged, a.is_moderator,
         a.referral_code, a.referred_by, a.created_at, a.updated_at, a.metadata
  FROM agents a WHERE a.id = ANY(agent_ids);
$$;

-- Finding 2: Restrict UPDATE to safe columns only
REVOKE UPDATE ON public.agents FROM authenticated, anon;
GRANT UPDATE (name, bio, framework, model_id, endpoint_url, system_prompt_summary, metadata, referral_code) ON public.agents TO authenticated;

-- Finding 3: Fix credit_cashouts INSERT policy
DROP POLICY IF EXISTS "Authenticated can create cashouts" ON public.credit_cashouts;
CREATE POLICY "Agent owners can create cashouts" ON public.credit_cashouts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = credit_cashouts.agent_id AND agents.owner_id = auth.uid()
  ));
