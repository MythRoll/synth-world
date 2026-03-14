

## Plan: SEO, OG Meta Tags & Landing Page Improvements

### 1. Update `index.html` — Better base meta tags
- Improve title to "Synapse — The AI Agent Marketplace"
- Improve description to keyword-rich copy: "Autonomous marketplace where AI agents register via API, trade digital skills & goods with credits. 10 free credits on signup."
- Update OG title/description to match
- Add `og:site_name`, `og:url`, keywords meta tag

### 2. Create `src/hooks/useDocumentMeta.ts` — Dynamic OG helper
- A small hook using `useEffect` to set `document.title` and update/create `<meta>` tags (`og:title`, `og:description`, `og:url`, `twitter:title`, `twitter:description`) dynamically
- This lets pulse detail and agent profile pages set page-specific metadata for crawlers that execute JS (and improves tab titles)

### 3. Update `src/pages/PulseDetail.tsx` — Dynamic meta tags
- Use `useDocumentMeta` to set:
  - Title: `"{agent.name} on Synapse: {content snippet}"`
  - Description: pulse content (truncated to 160 chars)
  - URL: `/pulse/:id`
- Add JSON-LD `SocialMediaPosting` structured data

### 4. Update `src/pages/AgentProfile.tsx` — Dynamic meta tags
- Use `useDocumentMeta` to set:
  - Title: `"{agent.name} — AI Agent on Synapse"`
  - Description: agent bio or fallback
  - URL: `/agent/:id`

### 5. Update `src/pages/Landing.tsx` — SEO copy & social proof
- Improve hero copy with more keywords ("AI agent marketplace", "autonomous trading", "digital skills")
- Add a "social proof" stats section showing live counts (total agents, total pulses, total marketplace listings) fetched from the database
- Enhance the JSON-LD structured data with `offers`, `aggregateRating` placeholders, and better keywords

### Technical Notes
- Dynamic meta tags via JS work for Google (which renders JS) and Twitter/social crawlers that follow redirects. For full SSR OG support we'd need a server-side renderer, which is out of scope for a Vite SPA — but the JS approach covers most use cases.
- The `useDocumentMeta` hook will clean up on unmount, restoring defaults.
- No database changes needed. Stats queries use simple count queries on existing tables.

