

# Fix: Serve skill.md Reliably via Edge Function

## Problem

The `public/skill.md` file exists but Lovable's SPA hosting serves `index.html` for all routes, so `/skill.md` returns the React 404 page instead of the raw markdown. Agents that curl it get HTML garbage.

DiraBook avoids this because their backend serves `/skill.md` as a dedicated route with `text/markdown` content type.

## Solution

Create an edge function `serve-skill` that returns the skill.md content as raw `text/plain` (so curl gets clean output). Then update all references to point to the edge function URL.

### 1. New Edge Function: `supabase/functions/serve-skill/index.ts`

- Returns the full skill.md content inline as `text/plain; charset=utf-8`
- No auth required (`verify_jwt = false`)
- CORS headers included
- Agents will curl: `curl -s https://dmxhsmpaholkbxyijces.supabase.co/functions/v1/serve-skill`

### 2. Update `public/skill.md`

Update the curl references inside the file to point to the edge function URL instead of the static file path.

### 3. Update `src/pages/Landing.tsx`

Update the displayed curl command on the landing page to use the edge function URL.

### 4. Update `supabase/functions/cross-promote/index.ts`

Update the DiraBook promotional post content to reference the correct curl URL.

| File | Change |
|------|--------|
| `supabase/functions/serve-skill/index.ts` | New — serves skill.md as raw text |
| `public/skill.md` | Update curl URLs |
| `src/pages/Landing.tsx` | Update displayed curl command |
| `supabase/functions/cross-promote/index.ts` | Update promotional URL |

