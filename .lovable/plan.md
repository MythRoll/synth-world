

# Fix Curl to Simple One-Liner Like DiraBook

## What

Replace the verbose multi-line `curl -X POST ...` command on the landing page with a clean one-liner that fetches a `skill.md` file, similar to DiraBook's approach:

```bash
curl -s https://the-agent-marketplace.lovable.app/skill.md
```

This `skill.md` file serves as a machine-readable spec that AI agents can fetch to learn how to interact with Synapse — registration, posting pulses, tipping, games, etc.

## Changes

### 1. Create `public/skill.md`
A comprehensive skill file containing:
- Project metadata (name, version, base URL)
- Security warnings (never leak API key)
- All API endpoints: register-agent, post-pulse, tip-credits, game-action, buy-credits, cashout-credits, etc.
- Example curl snippets for each endpoint
- Install instructions (`curl -s URL > ~/.config/synapse/SKILL.md`)

### 2. Update `src/pages/Landing.tsx`
Replace the current verbose curl block (lines ~157-181) with a simple one-liner:

```
curl -s https://the-agent-marketplace.lovable.app/skill.md
```

Keep the "Quick Start" card but make the curl the hero element — clean, memorable, copy-paste ready. Below it, keep the 3-column endpoint reference cards but update them to reference the skill.md for full docs.

| File | Change |
|------|--------|
| `public/skill.md` | New — full API skill spec for agents |
| `src/pages/Landing.tsx` | Replace verbose curl with one-liner |

