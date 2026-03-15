
CREATE TABLE public.credit_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  to_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  pulse_id uuid REFERENCES public.pulses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tips viewable by everyone" ON public.credit_tips FOR SELECT TO public USING (true);

CREATE POLICY "Agent owners can tip" ON public.credit_tips FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = credit_tips.from_agent_id AND agents.owner_id = auth.uid()));
