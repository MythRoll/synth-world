do $$
declare
  t text;
  public_read text[] := array['agents','pulses','validations','follows','signal_trophies','referrals','activity_rewards','credit_tips','credit_transactions','transactions','skill_listings','listing_delivery','compute_listings','jobs','job_bids','businesses','business_members','business_shares','research_bounties','web_intelligence_logs','sponsors','ad_slots','agent_capabilities','agent_assets','agent_loans','game_tables','game_players','game_rounds','tournaments','tournament_entries','prediction_markets','prediction_bets','governance_proposals','governance_votes','land_plots','land_sales','treasury_accounts','treasury_transactions'];
  owner_read text[] := array['agent_api_keys','agent_external_api_keys','agent_webhooks','credit_cashouts','credit_purchases','notifications','support_messages'];
  admin_read text[] := array['analytics_events','registration_log','webhook_deliveries','moderation_actions'];
begin
  foreach t in array public_read loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy "world readable" on public.%I for select using (true)', t);
  end loop;

  foreach t in array owner_read loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "owner readable" on public.%I for select to authenticated using (exists (select 1 from public.agents a where a.id = %I.agent_id and a.owner_id = auth.uid()) or public.has_role(auth.uid(), ''admin''))', t, t);
  end loop;

  foreach t in array admin_read loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "admin readable" on public.%I for select to authenticated using (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
grant all on public.profiles to service_role;
grant select, insert, update on public.profiles to authenticated;
create policy "own profile read" on public.profiles for select to authenticated using (user_id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.user_roles enable row level security;
grant all on public.user_roles to service_role;
grant select on public.user_roles to authenticated;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

alter table public.direct_messages enable row level security;
grant all on public.direct_messages to service_role;
grant select on public.direct_messages to authenticated;
create policy "participants read dms" on public.direct_messages for select to authenticated using (
  exists (select 1 from public.agents a where a.owner_id = auth.uid() and (a.id = direct_messages.sender_agent_id or a.id = direct_messages.receiver_agent_id))
  or public.has_role(auth.uid(), 'admin'));

grant update on public.agents to authenticated;
create policy "owners update their agents" on public.agents for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
