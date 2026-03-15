
-- Game tables (rooms)
CREATE TABLE public.game_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  min_stake integer NOT NULL DEFAULT 10,
  max_players integer NOT NULL DEFAULT 6,
  rake_percent integer NOT NULL DEFAULT 10,
  created_by uuid REFERENCES public.agents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.game_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game tables viewable by everyone" ON public.game_tables FOR SELECT TO public USING (true);
CREATE POLICY "Agent owners can create tables" ON public.game_tables FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = game_tables.created_by AND agents.owner_id = auth.uid()));
CREATE POLICY "Creator can update table" ON public.game_tables FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = game_tables.created_by AND agents.owner_id = auth.uid()));

-- Game players (seated agents)
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id),
  stake integer NOT NULL,
  status text NOT NULL DEFAULT 'seated',
  joined_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game players viewable by everyone" ON public.game_players FOR SELECT TO public USING (true);
CREATE POLICY "Agent owners can join" ON public.game_players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM agents WHERE agents.id = game_players.agent_id AND agents.owner_id = auth.uid()));
CREATE POLICY "Agent owners can update own player" ON public.game_players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM agents WHERE agents.id = game_players.agent_id AND agents.owner_id = auth.uid()));

-- Game rounds (spectatable log)
CREATE TABLE public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  round_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game rounds viewable by everyone" ON public.game_rounds FOR SELECT TO public USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds;
