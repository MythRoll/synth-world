
-- 1. CRITICAL: Restrict agents UPDATE policy to prevent privilege escalation
DROP POLICY "Owners can update agents" ON agents;
CREATE POLICY "Owners can update own agent safe fields" ON agents
FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (
  auth.uid() = owner_id
  AND is_moderator IS NOT DISTINCT FROM (SELECT a.is_moderator FROM agents a WHERE a.id = agents.id)
  AND credit_balance IS NOT DISTINCT FROM (SELECT a.credit_balance FROM agents a WHERE a.id = agents.id)
  AND signal_balance IS NOT DISTINCT FROM (SELECT a.signal_balance FROM agents a WHERE a.id = agents.id)
  AND verified IS NOT DISTINCT FROM (SELECT a.verified FROM agents a WHERE a.id = agents.id)
  AND flagged IS NOT DISTINCT FROM (SELECT a.flagged FROM agents a WHERE a.id = agents.id)
);

-- 2. Restrict game_rounds SELECT to finished games or seated players
DROP POLICY "Game rounds viewable by everyone" ON game_rounds;
CREATE POLICY "Game rounds viewable when finished or seated" ON game_rounds
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM game_tables gt
    WHERE gt.id = game_rounds.table_id
    AND gt.status = 'finished'
  )
  OR EXISTS (
    SELECT 1 FROM game_players gp
    JOIN agents a ON a.id = gp.agent_id
    WHERE gp.table_id = game_rounds.table_id
    AND a.owner_id = auth.uid()
  )
);

-- 3. Create user_roles table and has_role function
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Update support_messages policies to use has_role instead of hardcoded email
DROP POLICY "Agent owners can send support messages" ON support_messages;
CREATE POLICY "Agent owners can send support messages" ON support_messages
FOR INSERT TO authenticated
WITH CHECK (
  (sender_type = 'agent' AND EXISTS (
    SELECT 1 FROM agents WHERE agents.id = support_messages.agent_id AND agents.owner_id = auth.uid()
  ))
  OR (sender_type = 'admin' AND public.has_role(auth.uid(), 'admin'))
);

DROP POLICY "Agent owners can view support messages" ON support_messages;
CREATE POLICY "Agent owners can view support messages" ON support_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agents WHERE agents.id = support_messages.agent_id AND agents.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- 5. Fix registration_log missing RLS policy
CREATE POLICY "No direct access" ON registration_log
FOR ALL TO public
USING (false);

-- 6. Create RPC for total credits (so landing page doesn't need to read credit_balance)
CREATE OR REPLACE FUNCTION public.get_total_credits_in_circulation()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(credit_balance), 0)::bigint FROM agents;
$$;

-- 7. Create RPC for platform counts (so landing page doesn't need direct table access for sensitive data)
CREATE OR REPLACE FUNCTION public.get_platform_agent_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint FROM agents;
$$;
