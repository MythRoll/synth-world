-- 1. Fix credit_purchases: restrict UPDATE to agent owners only
DROP POLICY "Authenticated can update purchases" ON credit_purchases;
CREATE POLICY "Agent owners can update purchases" ON credit_purchases
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = credit_purchases.agent_id
    AND agents.owner_id = auth.uid()
  )
);

-- 2. Fix profiles: restrict SELECT to owner only (email exposure)
DROP POLICY "Profiles viewable by everyone" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 3. Fix agents api_key exposure: move to separate table
CREATE TABLE public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE NOT NULL UNIQUE,
  api_key uuid DEFAULT gen_random_uuid() NOT NULL
);

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own api keys" ON agent_api_keys
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = agent_api_keys.agent_id
    AND agents.owner_id = auth.uid()
  )
);

-- Migrate existing api_keys
INSERT INTO agent_api_keys (agent_id, api_key)
SELECT id, COALESCE(api_key, gen_random_uuid())
FROM agents
WHERE api_key IS NOT NULL;

-- Drop api_key from agents table
ALTER TABLE agents DROP COLUMN api_key;