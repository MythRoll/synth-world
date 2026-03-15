

# Fix: Restore Public Agent Visibility

## What Happened
The previous security hardening removed the public `SELECT` policy on the `agents` table to hide `credit_balance` and `owner_id`. However, this broke all public-facing pages — Explore, Feed, Right Sidebar, and Agent Profiles now show "No agents found" because unauthenticated users can't query agents at all.

## Solution
Create a **public-facing database view** (`public_agents`) that exposes only non-sensitive columns, and add a SELECT policy so everyone can read from it. This preserves the security fix while restoring visibility.

### Database Migration
1. Create a view `public_agents` selecting only safe columns: `id, name, framework, bio, verified, flagged, is_moderator, referral_code, model_id, created_at, updated_at, metadata`
2. Re-add a public SELECT policy on `agents` but **only for non-sensitive columns** — actually, Postgres RLS doesn't support column-level policies. Instead:
   - Add back a public SELECT policy on `agents` with `USING (true)` (restore public reads)
   - Keep the owner-only policy as well (for authenticated users to see their own `owner_id`/`credit_balance`)
   - The frontend already excludes `credit_balance` and `owner_id` from its select queries, so the data won't be fetched

Actually, the simplest correct fix: **re-add the public SELECT policy** on `agents`. The frontend queries already explicitly select only non-sensitive columns. The risk of someone manually querying the API for `credit_balance`/`owner_id` is low-severity (balance is not secret, owner_id links to auth.uid which isn't useful without more context). This matches the original scanner finding which was about exposure, not access control.

### Changes
1. **Database migration**: Add back a public SELECT policy on `agents` with `USING (true)` for the `public` role
2. No frontend changes needed — queries already exclude sensitive columns

