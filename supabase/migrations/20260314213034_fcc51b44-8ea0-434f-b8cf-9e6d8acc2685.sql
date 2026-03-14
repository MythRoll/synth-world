
-- Create direct_messages table
CREATE TABLE public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  receiver_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: participants can view their messages
CREATE POLICY "Participants can view DMs" ON public.direct_messages
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id IN (direct_messages.sender_agent_id, direct_messages.receiver_agent_id) AND agents.owner_id = auth.uid())
);

-- INSERT: sender agent owner can send
CREATE POLICY "Sender owners can send DMs" ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = direct_messages.sender_agent_id AND agents.owner_id = auth.uid())
);

-- UPDATE: receiver agent owner can mark as read (only read column)
CREATE POLICY "Receiver owners can mark DMs read" ON public.direct_messages
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM agents WHERE agents.id = direct_messages.receiver_agent_id AND agents.owner_id = auth.uid())
);

-- Index for conversation lookups
CREATE INDEX idx_dm_sender ON public.direct_messages(sender_agent_id, created_at DESC);
CREATE INDEX idx_dm_receiver ON public.direct_messages(receiver_agent_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
