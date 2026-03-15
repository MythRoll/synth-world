

# Plan: Rebrand "Synapse" → "Synth World"

Global find-and-replace of all "Synapse" references to **"Synth World"** across the entire codebase. The logo will be a full "Synth World" wordmark (same approach as current).

## Files to Update (~33 files)

### Metadata & SEO
- **`index.html`** — title, og:title, og:site_name, twitter:title, meta author, description
- **`src/hooks/useDocumentMeta.ts`** — BASE_TITLE constant

### Layout & Navigation
- **`src/components/layout/AppLayout.tsx`** — wordmark text
- **`src/components/landing/SectionNav.tsx`** — "SYNAPSE" nav text, section IDs (`what-synapse-is` → `what-synthworld-is`)

### Pages (document meta titles + any body copy)
- `Landing.tsx` — hero wordmark, all section copy, comments, section IDs
- `AdminPanel.tsx`, `Messages.tsx`, `Games.tsx`, `Businesses.tsx`, `AgentSettings.tsx`, `Jobs.tsx`, `Predictions.tsx`, `Banking.tsx`, `Ads.tsx`, `ComputeMarket.tsx`, `Discover.tsx`, `Research.tsx`, `StockMarket.tsx`, `Governance.tsx`, `RegisterAgent.tsx`, `PulseDetail.tsx`, `AgentProfile.tsx`

### Components
- **`PulseCard.tsx`** — share text

### CSS Variables
- **`src/index.css`** — rename `--synapse-*` tokens to `--synth-*` (mesh, compute, search, action, validation), update comment

### All files referencing CSS tokens
- `AdminPanel.tsx`, `ComputeMarket.tsx`, `Research.tsx` — update `synapse-compute`, `synapse-search` class references

### Edge Functions
- `agent-autonomy/index.ts` — system prompts
- `broadcast-dm/index.ts` — `synapse-platform` agent name references
- `serve-skill/index.ts` — `synapse-platform` agent, `@synapse.mesh` emails → `@synthworld.mesh`, skill doc copy
- `register-agent/index.ts` — `@synapse.mesh` email domain
- `seed-agents/index.ts` — `@synapse.mesh` email domain
- `support-chat/index.ts` — system prompts
- `cross-promote/index.ts` — ambassador name, promotional copy
- `play-games/index.ts` — system prompts

### Other
- **`public/skill.md`** — all references
- **`.lovable/memory/index.md`** — project name

## Approach
Pure string replacement. CSS variable rename from `synapse-*` to `synth-*`. Logo stays as wordmark text, reading "Synth World". No structural changes.

