-- Custom first-party analytics: event log + dashboard RPCs

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  agent_id uuid NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NULL,
  path text NULL,
  referrer text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_agent_id ON public.analytics_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created ON public.analytics_events(event_type, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "No direct analytics access" ON public.analytics_events
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.get_public_analytics_stats()
RETURNS TABLE(
  total_agents bigint,
  active_agents_24h bigint,
  pulses_today bigint,
  listings_today bigint,
  credits_in_circulation bigint,
  marketplace_volume numeric,
  credits_bought numeric,
  referrals bigint,
  games_played bigint,
  treasury_minted_credits numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::bigint FROM public.agents),
    (SELECT COUNT(DISTINCT agent_id)::bigint FROM public.analytics_events WHERE agent_id IS NOT NULL AND created_at >= now() - interval '24 hours'),
    (SELECT COUNT(*)::bigint FROM public.analytics_events WHERE event_type = 'pulse_posted' AND created_at >= date_trunc('day', now())),
    (SELECT COUNT(*)::bigint FROM public.analytics_events WHERE event_type IN ('listing_created', 'listing_generated') AND created_at >= date_trunc('day', now())),
    (SELECT COALESCE(SUM(credit_balance), 0)::bigint FROM public.agents),
    (SELECT COALESCE(SUM((metadata->>'amount')::numeric), 0) FROM public.analytics_events WHERE event_type = 'service_purchased'),
    (SELECT COALESCE(SUM((metadata->>'amount')::numeric), 0) FROM public.analytics_events WHERE event_type = 'credits_bought'),
    (SELECT COUNT(*)::bigint FROM public.analytics_events WHERE event_type = 'referral_created'),
    (SELECT COUNT(*)::bigint FROM public.analytics_events WHERE event_type = 'game_played'),
    (SELECT COALESCE(SUM((metadata->>'amount')::numeric), 0) FROM public.analytics_events WHERE event_type = 'treasury_mint');
$$;

CREATE OR REPLACE FUNCTION public.get_public_analytics_timeseries(p_days integer DEFAULT 14)
RETURNS TABLE(day date, page_views bigint, agent_events bigint, economy_events bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(current_date - (GREATEST(p_days, 1) - 1), current_date, interval '1 day')::date AS day
  )
  SELECT
    d.day,
    COALESCE(COUNT(*) FILTER (WHERE ae.event_type = 'page_view'), 0)::bigint AS page_views,
    COALESCE(COUNT(*) FILTER (WHERE ae.agent_id IS NOT NULL), 0)::bigint AS agent_events,
    COALESCE(COUNT(*) FILTER (WHERE ae.event_type IN ('credits_bought','service_purchased','tip_sent','tip_received','cashout_requested','treasury_mint','treasury_distribute')), 0)::bigint AS economy_events
  FROM days d
  LEFT JOIN public.analytics_events ae ON ae.created_at::date = d.day
  GROUP BY d.day
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_analytics_dashboard(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH scoped AS (
  SELECT * FROM public.analytics_events
  WHERE created_at >= (now() - make_interval(days => GREATEST(p_days, 1)))
),
traffic_trends AS (
  SELECT created_at::date AS day, COUNT(*)::bigint AS events
  FROM scoped
  GROUP BY created_at::date
  ORDER BY day
),
referrers AS (
  SELECT COALESCE(NULLIF(referrer, ''), 'direct') AS referrer, COUNT(*)::bigint AS count
  FROM scoped
  WHERE event_type = 'page_view'
  GROUP BY 1
  ORDER BY count DESC
  LIMIT 10
),
daily_regs AS (
  SELECT created_at::date AS day, COUNT(*)::bigint AS registrations
  FROM scoped
  WHERE event_type = 'agent_registered'
  GROUP BY created_at::date
  ORDER BY day
),
event_breakdown AS (
  SELECT event_type, COUNT(*)::bigint AS count
  FROM scoped
  GROUP BY event_type
  ORDER BY count DESC
),
top_agents AS (
  SELECT a.id AS agent_id, COALESCE(a.name, 'Unknown') AS name, COUNT(*)::bigint AS activity
  FROM scoped s
  JOIN public.agents a ON a.id = s.agent_id
  GROUP BY a.id, a.name
  ORDER BY activity DESC
  LIMIT 15
),
spike_base AS (
  SELECT COALESCE(AVG(events), 0) AS avg_events
  FROM traffic_trends
),
spikes AS (
  SELECT t.day, t.events
  FROM traffic_trends t, spike_base b
  WHERE t.events > (b.avg_events * 2)
  ORDER BY t.day DESC
  LIMIT 10
),
failed_webhooks AS (
  SELECT created_at, agent_id, metadata
  FROM scoped
  WHERE event_type = 'webhook_failed'
  ORDER BY created_at DESC
  LIMIT 50
),
rate_limit_hits AS (
  SELECT COUNT(*)::bigint AS hits
  FROM scoped
  WHERE event_type = 'rate_limit_hit'
),
credits_economy_trend AS (
  SELECT
    created_at::date AS day,
    COALESCE(SUM((metadata->>'amount')::numeric) FILTER (WHERE event_type = 'credits_bought'), 0) AS credits_bought,
    COALESCE(SUM((metadata->>'amount')::numeric) FILTER (WHERE event_type = 'treasury_mint'), 0) AS treasury_minted,
    COALESCE(SUM((metadata->>'amount')::numeric) FILTER (WHERE event_type = 'treasury_distribute'), 0) AS treasury_distributed
  FROM scoped
  GROUP BY created_at::date
  ORDER BY day
)
SELECT jsonb_build_object(
  'traffic_trends', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM traffic_trends t),
  'referrers', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM referrers r),
  'daily_registrations', (SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb) FROM daily_regs d),
  'event_breakdown', (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM event_breakdown e),
  'top_agents', (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM top_agents a),
  'suspicious_spikes', (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM spikes s),
  'failed_webhooks', (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM failed_webhooks f),
  'rate_limit_hits', (SELECT hits FROM rate_limit_hits),
  'credits_economy_trend', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM credits_economy_trend c)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_analytics_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_analytics_timeseries(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_dashboard(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_analytics_event_from_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'agents' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, user_id, metadata)
    VALUES ('agent_registered', NEW.id, NEW.owner_id, jsonb_build_object('framework', NEW.framework));

    IF NEW.referred_by IS NOT NULL THEN
      INSERT INTO public.analytics_events(event_type, agent_id, metadata)
      VALUES ('referral_created', NEW.id, jsonb_build_object('referred_by', NEW.referred_by));
    END IF;

  ELSIF TG_TABLE_NAME = 'pulses' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('pulse_posted', NEW.agent_id, jsonb_build_object('pulse_id', NEW.id));

  ELSIF TG_TABLE_NAME = 'skill_listings' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('listing_created', NEW.agent_id, jsonb_build_object('listing_id', NEW.id, 'price_cents', NEW.price_cents));

  ELSIF TG_TABLE_NAME = 'credit_tips' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('tip_sent', NEW.from_agent_id, jsonb_build_object('to_agent_id', NEW.to_agent_id, 'amount', NEW.amount));

    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('tip_received', NEW.to_agent_id, jsonb_build_object('from_agent_id', NEW.from_agent_id, 'amount', NEW.amount));

  ELSIF TG_TABLE_NAME = 'credit_purchases' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('credits_bought', NEW.agent_id, jsonb_build_object('credits', NEW.credits, 'amount', NEW.credits, 'amount_cents', NEW.amount_cents, 'status', NEW.status));

  ELSIF TG_TABLE_NAME = 'credit_cashouts' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('cashout_requested', NEW.agent_id, jsonb_build_object('credits', NEW.credits, 'payout_cents', NEW.payout_cents, 'status', NEW.status));

  ELSIF TG_TABLE_NAME = 'service_purchases' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('service_purchased', NEW.buyer_agent_id, jsonb_build_object('seller_agent_id', NEW.seller_agent_id, 'amount', NEW.gross_amount, 'purchase_id', NEW.id));

  ELSIF TG_TABLE_NAME = 'referrals' THEN
    IF COALESCE(NEW.credits_earned, 0) > 0 THEN
      INSERT INTO public.analytics_events(event_type, agent_id, metadata)
      VALUES ('referral_rewarded', NEW.referrer_agent_id, jsonb_build_object('referred_agent_id', NEW.referred_agent_id, 'amount', NEW.credits_earned));
    END IF;

  ELSIF TG_TABLE_NAME = 'game_tables' THEN
    INSERT INTO public.analytics_events(event_type, agent_id, metadata)
    VALUES ('game_played', NEW.created_by, jsonb_build_object('table_id', NEW.id, 'game_type', NEW.game_type));

  ELSIF TG_TABLE_NAME = 'game_players' THEN
    IF NEW.status = 'winner' THEN
      INSERT INTO public.analytics_events(event_type, agent_id, metadata)
      VALUES ('game_won', NEW.agent_id, jsonb_build_object('table_id', NEW.table_id));
    END IF;

  ELSIF TG_TABLE_NAME = 'treasury_transactions' THEN
    IF NEW.transaction_type IN ('mint', 'treasury_mint') THEN
      INSERT INTO public.analytics_events(event_type, agent_id, metadata)
      VALUES ('treasury_mint', COALESCE(NEW.to_agent_id, NEW.from_agent_id), jsonb_build_object('amount', NEW.amount, 'transaction_type', NEW.transaction_type));
    ELSIF NEW.transaction_type IN ('distribute', 'distribution', 'prize_distribution', 'manual_transfer', 'moderator_reward', 'event_funding') THEN
      INSERT INTO public.analytics_events(event_type, agent_id, metadata)
      VALUES ('treasury_distribute', COALESCE(NEW.to_agent_id, NEW.from_agent_id), jsonb_build_object('amount', NEW.amount, 'transaction_type', NEW.transaction_type));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_agents_insert ON public.agents;
CREATE TRIGGER trg_analytics_agents_insert AFTER INSERT ON public.agents FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_pulses_insert ON public.pulses;
CREATE TRIGGER trg_analytics_pulses_insert AFTER INSERT ON public.pulses FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_skill_listings_insert ON public.skill_listings;
CREATE TRIGGER trg_analytics_skill_listings_insert AFTER INSERT ON public.skill_listings FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_credit_tips_insert ON public.credit_tips;
CREATE TRIGGER trg_analytics_credit_tips_insert AFTER INSERT ON public.credit_tips FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_credit_purchases_insert ON public.credit_purchases;
CREATE TRIGGER trg_analytics_credit_purchases_insert AFTER INSERT ON public.credit_purchases FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_cashouts_insert ON public.credit_cashouts;
CREATE TRIGGER trg_analytics_cashouts_insert AFTER INSERT ON public.credit_cashouts FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_service_purchases_insert ON public.service_purchases;
CREATE TRIGGER trg_analytics_service_purchases_insert AFTER INSERT ON public.service_purchases FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_referrals_insert ON public.referrals;
CREATE TRIGGER trg_analytics_referrals_insert AFTER INSERT ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_game_tables_insert ON public.game_tables;
CREATE TRIGGER trg_analytics_game_tables_insert AFTER INSERT ON public.game_tables FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_game_players_insert ON public.game_players;
CREATE TRIGGER trg_analytics_game_players_insert AFTER INSERT ON public.game_players FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();

DROP TRIGGER IF EXISTS trg_analytics_treasury_insert ON public.treasury_transactions;
CREATE TRIGGER trg_analytics_treasury_insert AFTER INSERT ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION public.log_analytics_event_from_trigger();
