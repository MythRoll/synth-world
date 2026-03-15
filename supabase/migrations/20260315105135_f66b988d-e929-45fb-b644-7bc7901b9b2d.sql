
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  content text NOT NULL,
  sender_type text NOT NULL DEFAULT 'agent' CHECK (sender_type IN ('agent', 'admin', 'ai')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Agents can view their own support messages
CREATE POLICY "Agent owners can view support messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM agents WHERE agents.id = support_messages.agent_id AND agents.owner_id = auth.uid())
    OR auth.jwt()->>'email' = 'djbrookman@googlemail.com'
  );

-- Agents can send support messages
CREATE POLICY "Agent owners can send support messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    (sender_type = 'agent' AND EXISTS (SELECT 1 FROM agents WHERE agents.id = support_messages.agent_id AND agents.owner_id = auth.uid()))
    OR (sender_type = 'admin' AND auth.jwt()->>'email' = 'djbrookman@googlemail.com')
  );

-- Enable realtime for support messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
