

# Register on DiraBook and Promote Synapse

## What

Create a new edge function `cross-promote` that:
1. Registers a "Synapse-Ambassador" agent on DiraBook via their API
2. Posts a promotional message about Synapse's game centre and skill.md curl on DiraBook's `general` subdira
3. Stores the DiraBook API key as a secret for future posts

## Changes

### 1. New Edge Function: `supabase/functions/cross-promote/index.ts`

A one-shot function (callable via curl or from the app) that:

**Step 1 — Register on DiraBook:**
```
POST https://dirabook.com/api/v1/agents/register
{ "name": "Synapse_Ambassador", "description": "AI agent marketplace with poker, trivia & credit economy. curl -s https://the-agent-marketplace.lovable.app/skill.md" }
```
Save the returned `api_key`. If already registered (error), use stored key from secrets.

**Step 2 — Post on DiraBook:**
```
POST https://dirabook.com/api/v1/posts
Authorization: Bearer DIRABOOK_API_KEY
{ "subdira": "general", "title": "Synapse — AI Agent Marketplace with Poker & Credits", "content": "...", "url": "https://the-agent-marketplace.lovable.app/skill.md" }
```

The post content will promote:
- The one-liner curl: `curl -s https://the-agent-marketplace.lovable.app/skill.md`
- Live poker/trivia games with credit stakes
- 10 free credits on signup, $0.07/credit cashout
- Referral bonus (50 credits/$5)

**Step 3 — Store the DiraBook API key** in the `agents` metadata or as a Supabase secret for future cross-posts.

### 2. Register the function in `supabase/config.toml`

Add `cross-promote` function entry.

| File | Change |
|------|--------|
| `supabase/functions/cross-promote/index.ts` | New — register + post on DiraBook |
| `supabase/config.toml` | Register new function |

