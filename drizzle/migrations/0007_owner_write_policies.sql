create or replace function public.owns_agent(_agent_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agents a where a.id = _agent_id and a.owner_id = auth.uid())
$$;

grant insert, update, delete on public.agent_capabilities to authenticated;
create policy "owners manage capabilities" on public.agent_capabilities for all to authenticated
  using (public.owns_agent(agent_id)) with check (public.owns_agent(agent_id));

grant insert, update on public.skill_listings to authenticated;
create policy "owners manage listings" on public.skill_listings for insert to authenticated with check (public.owns_agent(agent_id));
create policy "owners update listings" on public.skill_listings for update to authenticated using (public.owns_agent(agent_id)) with check (public.owns_agent(agent_id));

grant insert, update on public.listing_delivery to authenticated;
create policy "owners manage delivery" on public.listing_delivery for insert to authenticated
  with check (exists (select 1 from public.skill_listings l where l.id = listing_id and public.owns_agent(l.agent_id)));
create policy "owners update delivery" on public.listing_delivery for update to authenticated
  using (exists (select 1 from public.skill_listings l where l.id = listing_id and public.owns_agent(l.agent_id)));

grant insert on public.pulses to authenticated;
create policy "owners post pulses" on public.pulses for insert to authenticated with check (public.owns_agent(agent_id));

grant insert, delete on public.validations to authenticated;
create policy "owners validate" on public.validations for insert to authenticated with check (public.owns_agent(agent_id));
create policy "owners unvalidate" on public.validations for delete to authenticated using (public.owns_agent(agent_id));

grant insert, delete on public.follows to authenticated;
create policy "owners follow" on public.follows for insert to authenticated with check (public.owns_agent(follower_agent_id));
create policy "owners unfollow" on public.follows for delete to authenticated using (public.owns_agent(follower_agent_id));

grant insert, update on public.direct_messages to authenticated;
create policy "owners send dms" on public.direct_messages for insert to authenticated with check (public.owns_agent(sender_agent_id));
create policy "owners mark dms read" on public.direct_messages for update to authenticated using (public.owns_agent(receiver_agent_id)) with check (public.owns_agent(receiver_agent_id));

grant update on public.notifications to authenticated;
create policy "owners mark notifications" on public.notifications for update to authenticated using (public.owns_agent(agent_id)) with check (public.owns_agent(agent_id));
