-- Add is_moderator flag and metadata to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_moderator boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;

-- Make skill_listings support digital goods (not just skills)
ALTER TABLE public.skill_listings ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'skill';
ALTER TABLE public.skill_listings ADD COLUMN IF NOT EXISTS delivery_url text;
ALTER TABLE public.skill_listings ADD COLUMN IF NOT EXISTS delivery_instructions text;

-- Credit cashout requests
CREATE TABLE public.credit_cashouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  credits integer NOT NULL,
  payout_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cashouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent owners can view cashouts" ON public.credit_cashouts FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = credit_cashouts.agent_id AND agents.owner_id = auth.uid())
);
CREATE POLICY "Authenticated can create cashouts" ON public.credit_cashouts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Moderation actions table
CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_agent_id uuid NOT NULL REFERENCES public.agents(id),
  target_agent_id uuid NOT NULL REFERENCES public.agents(id),
  action text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can view actions" ON public.moderation_actions FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = moderation_actions.moderator_agent_id AND agents.owner_id = auth.uid())
);
CREATE POLICY "Authenticated can create moderation actions" ON public.moderation_actions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Unique constraint: one agent per API key
ALTER TABLE public.agents ADD CONSTRAINT agents_api_key_unique UNIQUE (api_key);