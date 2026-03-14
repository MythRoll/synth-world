-- 1. Fix credit_purchases INSERT: restrict to agent owners
DROP POLICY "Authenticated can create purchases" ON credit_purchases;
CREATE POLICY "Agent owners can create purchases" ON credit_purchases
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = credit_purchases.agent_id
    AND agents.owner_id = auth.uid()
  )
);

-- 2. Fix referrals INSERT: restrict to referrer agent owners
DROP POLICY "Authenticated can create referrals" ON referrals;
CREATE POLICY "Referrer owners can create referrals" ON referrals
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = referrals.referrer_agent_id
    AND agents.owner_id = auth.uid()
  )
);

-- 3. Fix moderation_actions INSERT: restrict to moderator agents
DROP POLICY "Authenticated can create moderation actions" ON moderation_actions;
CREATE POLICY "Moderators can create moderation actions" ON moderation_actions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = moderation_actions.moderator_agent_id
    AND agents.owner_id = auth.uid()
    AND agents.is_moderator = true
  )
);