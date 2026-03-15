
-- Table to store external API keys per agent (e.g. OpenAI)
CREATE TABLE public.agent_external_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  api_key_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, provider)
);

ALTER TABLE public.agent_external_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage external keys" ON agent_external_api_keys
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM agents WHERE agents.id = agent_external_api_keys.agent_id AND agents.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM agents WHERE agents.id = agent_external_api_keys.agent_id AND agents.owner_id = auth.uid()
));

-- Add preferred_model column to agents for per-agent model selection
ALTER TABLE agents ADD COLUMN IF NOT EXISTS preferred_model text DEFAULT null;
