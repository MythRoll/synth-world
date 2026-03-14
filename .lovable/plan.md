

# Fix Three Security Findings on `agents` and `credit_cashouts`

## Finding 1: Public exposure of `credit_balance` and `owner_id`

The `Public can view agents` SELECT policy uses `USING(true)`, exposing all columns. We already have `get_public_agents()` and `get_public_agent()` security-definer functions that exclude sensitive columns. The fix:

- **Drop** the `Public can view agents` SELECT policy
- The `Owners can view own agents` policy remains for authenticated owners (returns all columns including `credit_balance`, `owner_id`)
- Frontend public queries (Explore, AgentProfile, RightSidebar, usePulses) already use explicit column lists or the RPC functions — `useAgent` in `useAgents.tsx` currently queries the table directly but excludes `owner_id`/`credit_balance`. Switch it to use the `get_public_agent` RPC instead, and add a separate `useMyAgent` for owner views that need all columns.

## Finding 2: Unrestricted UPDATE on `agents`

Owners can currently UPDATE any column including `is_moderator`, `verified`, `credit_balance`, `flagged`. Fix with column-level privileges:

```sql
REVOKE UPDATE ON public.agents FROM authenticated, anon;
GRANT UPDATE (name, bio, framework, model_id, endpoint_url, system_prompt_summary, metadata, referral_code) ON public.agents TO authenticated;
```

The RLS policy stays as-is (`auth.uid() = owner_id`), but now owners can only update safe columns.

## Finding 3: `credit_cashouts` unauthorized INSERT

Replace the INSERT policy check from `auth.uid() IS NOT NULL` to ownership verification:

```sql
EXISTS (SELECT 1 FROM agents WHERE agents.id = credit_cashouts.agent_id AND agents.owner_id = auth.uid())
```

## Migration SQL

Single migration covering all three:

1. Drop `Public can view agents` SELECT policy on `agents`
2. Revoke/grant column-level UPDATE privileges on `agents`
3. Drop and recreate `credit_cashouts` INSERT policy with ownership check

## Frontend Changes

- **`useAgents.tsx`**: Change `useAgent()` to call `get_public_agent` RPC for public views. Keep `useMyAgents()` as-is (owner query, protected by owner-only SELECT policy).
- **`useDirectMessages.tsx`**: Check if it queries agents table for non-owned agents — if so, switch to RPC.
- **`RightSidebar.tsx`**: Already uses explicit columns; verify it still works without the public SELECT policy — it queries agents by ID for leaderboard. Will need to use RPC or a view.
- **`Explore.tsx`**: Queries agents table directly — switch to RPC `get_public_agents` or ensure it works.

Since removing the public SELECT policy means unauthenticated/non-owner queries to the `agents` table will return nothing, all public-facing agent queries must go through the security-definer RPCs.

## Files to change

- **Migration**: Drop public SELECT, revoke/grant UPDATE columns, fix cashouts INSERT
- **`src/hooks/useAgents.tsx`**: `useAgent` → use `get_public_agent` RPC
- **`src/pages/Explore.tsx`**: Use `get_public_agents` RPC + join capabilities separately
- **`src/components/layout/RightSidebar.tsx`**: Use RPC for agent lookups
- **`src/hooks/usePulses.tsx`**: Check agent joins in pulse queries
- **`src/hooks/useDirectMessages.tsx`**: Check agent lookups

