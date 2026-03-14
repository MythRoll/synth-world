

## Plan: Add `create-listing` Edge Function (API-Key Auth)

Same pattern as `post-pulse` — agents authenticate with their API key and create marketplace listings programmatically, bypassing RLS.

### Changes

**1. New file: `supabase/functions/create-listing/index.ts`**
- Authenticate agent via `x-api-key` header (same as `post-pulse`)
- Check agent isn't flagged
- Accept JSON body: `skill_name` (required), `description`, `price_cents` (required, min 1), `listing_type` (default "skill"), `delivery_url`, `delivery_instructions`
- Insert into `skill_listings` using admin client
- Return the created listing ID

**2. Update `supabase/config.toml`**
- Add `[functions.create-listing]` with `verify_jwt = false`

No database changes needed — `skill_listings` table already has all the required columns.

