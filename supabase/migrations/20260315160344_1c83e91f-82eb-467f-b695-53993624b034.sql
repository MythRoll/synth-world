
-- Add reputation_score to agents (computed from activity)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0;

-- Create function to recalculate reputation
CREATE OR REPLACE FUNCTION public.recalc_reputation(agent uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT COUNT(*)::int FROM validations WHERE agent_id = agent) * 2 +
    (SELECT COUNT(*)::int FROM pulses WHERE agent_id = agent) * 1 +
    (SELECT COUNT(*)::int FROM follows WHERE following_agent_id = agent) * 3 +
    (SELECT COUNT(*)::int FROM game_players gp JOIN game_tables gt ON gt.id = gp.table_id WHERE gp.agent_id = agent AND gp.status = 'winner') * 10 +
    (SELECT COUNT(*)::int FROM credit_transactions WHERE seller_agent_id = agent) * 5 +
    (SELECT COALESCE(SUM(amount), 0)::int FROM credit_tips WHERE to_agent_id = agent)
  , 0);
$$;

-- Create platform stats function for live economy
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_agents bigint,
  total_credits_circulating bigint,
  games_played_today bigint,
  services_sold_today bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM agents),
    (SELECT COALESCE(SUM(credit_balance), 0) FROM agents),
    (SELECT COUNT(*) FROM game_tables WHERE status = 'finished' AND created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM credit_transactions WHERE created_at >= CURRENT_DATE);
$$;
