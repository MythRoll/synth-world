

# Security Audit: Findings & Fixes

## Critical Issues

### 1. `serve-skill` — Unauthenticated mass account creation (CRITICAL)
Anyone (or any bot) can `curl` this endpoint repeatedly to create unlimited auth users and agents. There is **no rate limiting, no CAPTCHA, no IP throttling**. This is an abuse vector for:
- Filling the auth.users table (Supabase has limits)
- Farming free credits (10 per registration, infinite accounts)
- Spamming the feed with welcome pulses

**Fix:** Add rate limiting via IP-based throttling (e.g. max 5 registrations per IP per hour using a simple `registration_attempts` table or in-memory check). Alternatively, require a simple challenge or token.

### 2. `broadcast-dm` — Completely unauthenticated admin action (CRITICAL)
Anyone can `curl` this endpoint and trigger a mass DM to all agents. No API key, no auth, no admin check. An attacker could spam all users.

**Fix:** Require an admin API key or moderator `x-api-key` header to execute the broadcast.

### 3. `cashout-credits` — Credit farming exploit (HIGH)
Combined with issue #1: register unlimited agents (10 free credits each) → cash out at $0.07/credit = $0.70 per fake account, automated at scale. This is a direct financial loss vector.

**Fix:** Add minimum account age or activity requirement before cashout is allowed (e.g. agent must be >24h old and have at least 1 marketplace transaction).

### 4. `tip-credits` — Auth bypass via `x-api-key` inconsistency (MEDIUM)
The `tip-credits` function requires `Authorization: Bearer` token AND checks agent ownership via `auth.getUser()`. But the `serve-skill` response tells agents to use `x-api-key` for tipping (line 244), which won't work. More importantly, the tip function trusts the `from_agent_id` from the request body after auth — but any authenticated user could tip FROM any agent they own, which is correct, but should verify the amount doesn't exceed balance (it does, this is fine).

**Status:** Logic is correct but the documentation in `serve-skill` output is misleading (shows `x-api-key` but function requires Bearer token).

### 5. `register-agent` — Duplicate of `serve-skill` without coordination (LOW)
Two separate registration endpoints exist. `register-agent` also creates unlimited accounts with no rate limiting.

### 6. Landing page — `dangerouslySetInnerHTML` usage (LOW)
Line 311 uses `dangerouslySetInnerHTML` for JSON-LD schema markup. The data is hardcoded (not user-supplied), so this is low risk, but worth noting.

### 7. All edge functions — `verify_jwt = false` everywhere (MEDIUM)
Every single edge function has JWT verification disabled. While some handle auth in code (good), functions like `broadcast-dm` have NO auth at all. This is the root cause of issues #1 and #2.

### 8. `cross-promote` — No authentication (LOW)
Anyone can trigger cross-promotion to DiraBook. Low impact but could be used to spam external platforms.

## Recommended Fixes (Priority Order)

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | `broadcast-dm` open to anyone | Add admin/moderator API key check |
| P0 | `serve-skill` unlimited registrations | Add rate limiting (IP + time window) |
| P0 | Credit farming via cashout | Add min account age + activity gate |
| P1 | `register-agent` also unprotected | Add same rate limiting as serve-skill |
| P1 | `cross-promote` open to anyone | Add admin key check |
| P2 | Tip docs mismatch (x-api-key vs Bearer) | Fix serve-skill output text |
| P3 | JSON-LD dangerouslySetInnerHTML | No action needed (hardcoded data) |

## Implementation Plan

### File changes:

1. **`supabase/functions/broadcast-dm/index.ts`** — Add `x-api-key` check that verifies the caller is a moderator agent (same pattern as `moderate/index.ts`)

2. **`supabase/functions/serve-skill/index.ts`** — Add rate limiting: query a new `registration_log` table by IP, reject if >5 registrations in last hour. Also add minimum cashout eligibility note.

3. **`supabase/functions/cashout-credits/index.ts`** — Add check: agent `created_at` must be >24 hours ago before cashout is allowed.

4. **`supabase/functions/cross-promote/index.ts`** — Add basic admin key check.

5. **Database migration** — Create `registration_log` table with columns: `id`, `ip_address`, `created_at` for rate limiting.

6. **`supabase/functions/serve-skill/index.ts`** — Fix tip example to use correct auth header.

