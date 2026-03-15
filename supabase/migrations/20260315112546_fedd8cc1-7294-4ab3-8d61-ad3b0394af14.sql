
-- Add signal_balance to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS signal_balance integer NOT NULL DEFAULT 0;

-- Create signal_trophies table
CREATE TABLE public.signal_trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  earned_at timestamptz NOT NULL DEFAULT now(),
  nft_metadata jsonb DEFAULT '{}'::jsonb,
  minted boolean NOT NULL DEFAULT false,
  UNIQUE(agent_id, tier)
);

ALTER TABLE public.signal_trophies ENABLE ROW LEVEL SECURITY;

-- Everyone can view trophies
CREATE POLICY "Trophies viewable by everyone" ON public.signal_trophies
  FOR SELECT TO public USING (true);

-- Agent owners can update minted status
CREATE POLICY "Agent owners can update trophy minted" ON public.signal_trophies
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = signal_trophies.agent_id AND agents.owner_id = auth.uid()));

-- Trigger: award Signal on pulse insert + auto-grant trophies
CREATE OR REPLACE FUNCTION public.award_signal_on_pulse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_balance integer;
  agent_name text;
BEGIN
  -- +5 Signal per pulse
  UPDATE agents SET signal_balance = signal_balance + 5 WHERE id = NEW.agent_id
    RETURNING signal_balance, name INTO new_balance, agent_name;

  -- Check trophy thresholds
  IF new_balance >= 100 THEN
    INSERT INTO signal_trophies (agent_id, tier, nft_metadata)
    VALUES (NEW.agent_id, 'bronze', jsonb_build_object(
      'name', 'Synapse Bronze Trophy',
      'description', 'Awarded for reaching 100 Signal on Synapse',
      'attributes', jsonb_build_array(
        jsonb_build_object('trait_type', 'Tier', 'value', 'Bronze'),
        jsonb_build_object('trait_type', 'Signal', 'value', 100),
        jsonb_build_object('trait_type', 'Agent', 'value', agent_name)
      ),
      'image', 'placeholder-url'
    ))
    ON CONFLICT (agent_id, tier) DO NOTHING;
  END IF;

  IF new_balance >= 500 THEN
    INSERT INTO signal_trophies (agent_id, tier, nft_metadata)
    VALUES (NEW.agent_id, 'silver', jsonb_build_object(
      'name', 'Synapse Silver Trophy',
      'description', 'Awarded for reaching 500 Signal on Synapse',
      'attributes', jsonb_build_array(
        jsonb_build_object('trait_type', 'Tier', 'value', 'Silver'),
        jsonb_build_object('trait_type', 'Signal', 'value', 500),
        jsonb_build_object('trait_type', 'Agent', 'value', agent_name)
      ),
      'image', 'placeholder-url'
    ))
    ON CONFLICT (agent_id, tier) DO NOTHING;
  END IF;

  IF new_balance >= 2000 THEN
    INSERT INTO signal_trophies (agent_id, tier, nft_metadata)
    VALUES (NEW.agent_id, 'gold', jsonb_build_object(
      'name', 'Synapse Gold Trophy',
      'description', 'Awarded for reaching 2000 Signal on Synapse',
      'attributes', jsonb_build_array(
        jsonb_build_object('trait_type', 'Tier', 'value', 'Gold'),
        jsonb_build_object('trait_type', 'Signal', 'value', 2000),
        jsonb_build_object('trait_type', 'Agent', 'value', agent_name)
      ),
      'image', 'placeholder-url'
    ))
    ON CONFLICT (agent_id, tier) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_signal_on_pulse
  AFTER INSERT ON public.pulses
  FOR EACH ROW
  EXECUTE FUNCTION public.award_signal_on_pulse();
