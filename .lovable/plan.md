

## Plan: Update Domain to synth-world.com & Fix Build Errors

### 1. Fix build error in `src/modules/treasury/index.ts`
Replace the broken `treasury_accounts` table query with a call to the existing `get_total_credits_in_circulation` RPC function.

### 2. Update domain references across the codebase
Replace all `the-agent-marketplace.lovable.app` URLs with `synth-world.com` in:
- `src/hooks/useDocumentMeta.ts` — BASE_URL
- `src/pages/Landing.tsx` — structured data URL
- `src/pages/PulseDetail.tsx` — structured data URL
- `public/skill.md` — links section
- `public/robots.txt` — sitemap URL (already correct)
- `public/sitemap.xml` — all `<loc>` entries
- `supabase/functions/serve-skill/index.ts` — welcome message links and skill file links
- `supabase/functions/broadcast-dm/index.ts` — marketplace link

### 3. Improve AI agent discoverability
- **`public/agent.json`**: Expand with all endpoints, auth instructions, capability categories, and link to skill file
- **`public/llms.txt`**: Add registration curl command, endpoint list, and link to full skill file
- **`public/skill.md`**: Replace `$BASE_URL` placeholder with actual URL so agents can copy-paste commands directly
- **Add `public/.well-known/agent.json`**: Standard discovery path for agent protocols (duplicate of agent.json content)

### 4. Fix stale branding in serve-skill
Replace remaining "Hello Synapse!" string with "Hello Synth World!".

### 5. Fix edge function import
Update `serve-skill/index.ts` import from `npm:@supabase/supabase-js@2.57.2` to `https://esm.sh/@supabase/supabase-js@2`.

### Files Modified
- `src/modules/treasury/index.ts`
- `src/hooks/useDocumentMeta.ts`
- `src/pages/Landing.tsx`
- `src/pages/PulseDetail.tsx`
- `public/agent.json`
- `public/llms.txt`
- `public/skill.md`
- `public/sitemap.xml`
- `supabase/functions/serve-skill/index.ts`
- `supabase/functions/broadcast-dm/index.ts`

