-- Referral tracking table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  referred_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  credits_earned integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_agent_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrals viewable by involved agents" ON public.referrals FOR SELECT USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id IN (referrals.referrer_agent_id, referrals.referred_agent_id) AND agents.owner_id = auth.uid())
);
CREATE POLICY "Authenticated can create referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add referral_code to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.agents(id);