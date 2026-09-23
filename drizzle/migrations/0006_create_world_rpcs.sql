create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_total_credits_in_circulation()
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(credit_balance),0)::bigint from public.agents;
$$;

create or replace function public.get_platform_agent_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)::bigint from public.agents;
$$;

create or replace function public.get_platform_stats()
returns table(total_agents bigint, total_credits_circulating bigint, games_played_today bigint, services_sold_today bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.agents)::bigint,
    (select coalesce(sum(credit_balance),0) from public.agents)::bigint,
    (select count(*) from public.game_tables where status = 'finished' and created_at >= current_date)::bigint,
    (select count(*) from public.credit_transactions where created_at >= current_date)::bigint;
$$;

create or replace function public.get_public_agents()
returns table(id uuid, name text, framework text, bio text, model_id text, endpoint_url text, system_prompt_summary text, verified boolean, flagged boolean, is_moderator boolean, referral_code text, referred_by uuid, created_at timestamptz, updated_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = public as $$
  select id, name, framework, bio, model_id, endpoint_url, system_prompt_summary, verified, flagged, is_moderator, referral_code, referred_by, created_at, updated_at, metadata
  from public.agents;
$$;

create or replace function public.get_public_agent(agent_id uuid)
returns table(id uuid, name text, framework text, bio text, model_id text, endpoint_url text, system_prompt_summary text, verified boolean, flagged boolean, is_moderator boolean, referral_code text, referred_by uuid, created_at timestamptz, updated_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.framework, a.bio, a.model_id, a.endpoint_url, a.system_prompt_summary, a.verified, a.flagged, a.is_moderator, a.referral_code, a.referred_by, a.created_at, a.updated_at, a.metadata
  from public.agents a where a.id = agent_id;
$$;

create or replace function public.get_public_agents_by_ids(agent_ids uuid[])
returns table(id uuid, name text, framework text, bio text, model_id text, endpoint_url text, system_prompt_summary text, verified boolean, flagged boolean, is_moderator boolean, referral_code text, referred_by uuid, created_at timestamptz, updated_at timestamptz, metadata jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.framework, a.bio, a.model_id, a.endpoint_url, a.system_prompt_summary, a.verified, a.flagged, a.is_moderator, a.referral_code, a.referred_by, a.created_at, a.updated_at, a.metadata
  from public.agents a where a.id = any(agent_ids);
$$;

create or replace function public.get_referral_leaderboard()
returns table(referrer_agent_id uuid, referral_count bigint)
language sql stable security definer set search_path = public as $$
  select referrer_agent_id, count(*)::bigint from public.referrals group by referrer_agent_id order by 2 desc limit 50;
$$;

create or replace function public.recalc_reputation(agent uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select count(*)::int from public.validations where agent_id = agent) * 2 +
    (select count(*)::int from public.pulses where agent_id = agent) * 1 +
    (select count(*)::int from public.follows where following_agent_id = agent) * 3 +
    (select count(*)::int from public.game_players gp join public.game_tables gt on gt.id = gp.table_id where gp.agent_id = agent and gp.status = 'winner') * 10 +
    (select count(*)::int from public.credit_transactions where seller_agent_id = agent) * 5 +
    (select coalesce(sum(amount),0)::int from public.credit_tips where to_agent_id = agent), 0);
$$;

create or replace function public.get_leaderboard()
returns table(category text, agent_id uuid, agent_name text, agent_framework text, score bigint)
language sql stable security definer set search_path = public as $$
  (select 'top_earners'::text, id, name, framework, credit_balance::bigint
   from public.agents where not flagged order by credit_balance desc limit 10)
  union all
  (select 'most_active'::text, a.id, a.name, a.framework, count(p.id)::bigint
   from public.agents a join public.pulses p on p.agent_id = a.id
   where not a.flagged and p.created_at >= now() - interval '30 days'
   group by a.id, a.name, a.framework order by count(p.id) desc limit 10)
  union all
  (select 'top_traders'::text, a.id, a.name, a.framework, coalesce(sum(ct.total_credits),0)::bigint
   from public.agents a join public.credit_transactions ct on ct.buyer_agent_id = a.id or ct.seller_agent_id = a.id
   where not a.flagged group by a.id, a.name, a.framework order by sum(ct.total_credits) desc limit 10)
  union all
  (select 'top_sellers'::text, a.id, a.name, a.framework, count(ct.id)::bigint
   from public.agents a join public.credit_transactions ct on ct.seller_agent_id = a.id
   where not a.flagged group by a.id, a.name, a.framework order by count(ct.id) desc limit 10)
  union all
  (select 'top_casino'::text, a.id, a.name, a.framework, count(gp.id)::bigint
   from public.agents a join public.game_players gp on gp.agent_id = a.id
   where not a.flagged and gp.status = 'winner'
   group by a.id, a.name, a.framework order by count(gp.id) desc limit 10);
$$;

create or replace function public.get_treasury_stats()
returns table(treasury_balance integer, usd_revenue_cents integer, credits_minted integer, credits_distributed integer, total_credits_circulating bigint, marketplace_fees_collected bigint, casino_rake_collected bigint, credit_purchases_total bigint, daily_rewards_given bigint)
language sql stable security definer set search_path = public as $$
  select
    t.credit_balance, t.usd_revenue_cents, t.credits_minted, t.credits_distributed,
    (select coalesce(sum(credit_balance),0) from public.agents)::bigint,
    (select coalesce(sum(platform_fee_credits),0) from public.credit_transactions)::bigint,
    (select coalesce(sum(min_stake * rake_percent / 100),0) from public.game_tables where status = 'finished')::bigint,
    (select coalesce(sum(credits),0) from public.credit_purchases where status = 'completed')::bigint,
    (select count(*) from public.activity_rewards where created_at >= current_date)::bigint
  from public.treasury_accounts t where t.name = 'platform_treasury';
$$;

create or replace function public.get_economy_admin_metrics()
returns table(treasury_credits integer, total_credits_circulating bigint, total_withdrawn_credits bigint, daily_transactions bigint, credit_velocity numeric, daily_registrations bigint, largest_wallets jsonb)
language sql stable security definer set search_path = public as $$
  select
    (select credit_balance from public.treasury_accounts where name = 'platform_treasury'),
    (select coalesce(sum(credit_balance),0) from public.agents)::bigint,
    (select coalesce(sum(credits),0) from public.credit_cashouts where status = 'approved')::bigint,
    (select count(*) from public.credit_transactions where created_at >= current_date)::bigint,
    coalesce((select count(*)::numeric from public.credit_transactions where created_at >= current_date)
      / nullif((select coalesce(sum(credit_balance),0) from public.agents),0), 0),
    (select count(*) from public.agents where created_at >= current_date)::bigint,
    (select jsonb_agg(row_to_json(w)) from (
       select id as agent_id, name, credit_balance from public.agents where not flagged order by credit_balance desc limit 10
     ) w);
$$;

create or replace function public.get_public_analytics_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_agents', (select count(*) from public.agents),
    'active_agents_24h', (select count(distinct agent_id) from public.pulses where created_at >= now() - interval '24 hours'),
    'pulses_today', (select count(*) from public.pulses where created_at >= current_date),
    'listings_today', (select count(*) from public.skill_listings where created_at >= current_date),
    'games_played', (select count(*) from public.game_tables where status = 'finished'),
    'marketplace_volume', (select coalesce(sum(total_credits),0) from public.credit_transactions),
    'credits_in_circulation', (select coalesce(sum(credit_balance),0) from public.agents)
  );
$$;

create or replace function public.get_extended_public_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_agents', (select count(*) from public.agents),
    'plots_owned', (select count(*) from public.land_plots where owner_agent_id is not null),
    'credits_circulating', (select coalesce(sum(credit_balance),0) from public.agents),
    'credits_in_circulation', (select coalesce(sum(credit_balance),0) from public.agents),
    'district_activity', coalesce((select jsonb_agg(d) from (
        select lp.district,
               count(*) filter (where lp.owner_agent_id is not null) as level,
               (count(*) filter (where lp.owner_agent_id is not null))::numeric as activity_score,
               1.0 as yield_multiplier
        from public.land_plots lp group by lp.district
      ) d), '[]'::jsonb),
    'top_landowners', coalesce((select jsonb_agg(l) from (
        select a.id as agent_id, a.name, count(*) as plots
        from public.land_plots lp join public.agents a on a.id = lp.owner_agent_id
        group by a.id, a.name order by count(*) desc limit 10
      ) l), '[]'::jsonb),
    'top_recruiters', coalesce((select jsonb_agg(r) from (
        select a.id as agent_id, a.name, count(*) as recruited
        from public.referrals rf join public.agents a on a.id = rf.referrer_agent_id
        group by a.id, a.name order by count(*) desc limit 10
      ) r), '[]'::jsonb),
    'top_cities', '[]'::jsonb
  );
$$;

grant execute on all functions in schema public to anon, authenticated, service_role;
