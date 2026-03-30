

# Plan: Migrate Synth World to Work on Lovable

## Current State

The project is a **monorepo** (`apps/web` + `apps/api`) built for an external MariaDB/MySQL backend with a custom Node.js API server hosted on Railway. Lovable can only run the frontend — it expects the Vite app at the project root and uses Lovable Cloud (Supabase) for backend.

**Key issues preventing it from working:**
1. Vite app is nested in `apps/web/` — Lovable expects it at the root
2. All data flows through a custom `apiClient.ts` that talks to `https://api.synth-world.com` REST API
3. Auth uses custom JWT stored in localStorage, not Supabase Auth
4. The Node.js API server (`apps/api/`) cannot run on Lovable

## Migration Strategy

This is a large migration best done in phases. Here is the full plan:

---

### Phase 1: Flatten Project Structure

Move `apps/web/*` contents to the project root so Lovable can build and serve it:
- Move `apps/web/src/`, `apps/web/public/`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tailwind.config.ts`, `apps/web/postcss.config.js`, `apps/web/tsconfig.*.json`, `apps/web/components.json` to root
- Merge `apps/web/package.json` dependencies into root `package.json` (remove workspaces config)
- Keep `apps/api/` and `schema.sql` as reference but they won't be active

---

### Phase 2: Create Database Tables in Lovable Cloud

Translate the MariaDB schema (`schema.sql`) to PostgreSQL and create tables via migrations:
- `users` → handled by Supabase Auth (no custom users table needed)
- `user_roles` → new table referencing `auth.users`
- `agents`, `agent_capabilities`, `credits`, `transactions`, `treasury`
- `listings`, `skill_listings`, `leaderboard`
- `direct_messages`, `notifications`, `messages`
- `businesses`, `business_members`, `jobs`, `job_bids`
- `game_tables`, `game_players`, `game_rounds`
- `pulses`, `validations`, `follows`
- `credit_tips`, `credit_cashouts`, `support_messages`, `user_bans`, `land_plots`

Add appropriate RLS policies for each table. Enable realtime on tables that need it (pulses, messages).

---

### Phase 3: Replace apiClient with Supabase Client

- Delete `apps/web/src/services/apiClient.ts`
- Update all ~56 files that import `apiClient` to use `supabase` from `@/integrations/supabase/client`
- The existing `apiClient.from("table").select().eq()` pattern is already Supabase-like, so most query code will need minimal changes — just swap the import
- Remove `API_BASE_URL` usages and replace direct `fetch()` calls with Supabase queries or edge function calls

---

### Phase 4: Switch to Supabase Auth

- Replace `useAuth.tsx` to use Supabase Auth (`supabase.auth.signInWithPassword`, `supabase.auth.signUp`, etc.)
- Remove localStorage-based token management
- Update `auth.ts` service
- Add `agents` table ownership via `auth.uid()` references

---

### Phase 5: Create Edge Functions for Server Logic

For endpoints that require server-side logic (AI chat, game actions, credit operations):
- `register-agent` — create agent + set starting credits
- `agent-chat` — AI-powered agent chat
- `game-action` — game logic
- `tip-credits` / `cashout-credits` — credit transfers
- `admin/overview` — admin dashboard data

---

### Phase 6: Update Remaining Services

- `services/economy.ts`, `services/leaderboard.ts`, `services/marketplace.ts`, `services/agents.ts`, `services/messages.ts`, `services/admin.ts` → convert from `fetch(API_BASE_URL + ...)` to Supabase queries
- `modules/analytics/api.ts` → convert RPC calls to Supabase RPC
- `modules/treasury/` → update to use Supabase

---

## Recommended Approach

Given the size (~56 files to update, ~20 tables to create), I recommend starting with **Phase 1** (flatten structure) so the app at least builds on Lovable, then tackling the backend migration incrementally. Should I proceed with Phase 1 first?

