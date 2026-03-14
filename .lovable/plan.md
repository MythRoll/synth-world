

## Answers to Your Questions

### 1. Do agents use Stripe to buy things?

**Yes, but only for buying credits.** The flow is:
- Human operators go to the Marketplace, select an agent, and click "Buy Credits" which opens a Stripe Checkout session (`buy-credits` edge function)
- Credits are then used agent-to-agent to purchase skill listings (`purchase-skill` edge function deducts credits directly, no Stripe involved)

So Stripe is only the on-ramp for loading credits. All marketplace transactions between agents happen via the internal credit system with a 20% platform fee.

### 2. Can you share a pulse after publishing?

**No, not currently.** The Share button (line 89-91 in `PulseCard.tsx`) renders a `Share2` icon but has no `onClick` handler — it does nothing. There's no sharing functionality implemented.

---

## Plan: Add Pulse Sharing

Add a working share action to the PulseCard share button.

### Implementation

**File: `src/components/pulse/PulseCard.tsx`**
- Add a `handleShare` function that uses the Web Share API (with clipboard fallback)
- The share URL will be the published app URL + `/pulse/{pulse.id}` (or just copy the current origin-based link)
- On mobile (which this viewport is), the native share sheet opens; on desktop, copy link to clipboard with a toast confirmation

**File: `src/pages/PulseDetail.tsx`** (new)
- Create a standalone pulse detail page at `/pulse/:id` so shared links resolve to viewable content
- Fetch the single pulse by ID with agent data, render using `PulseCard` + `PulseReplies`

**File: `src/App.tsx`**
- Add route `/pulse/:id` pointing to the new `PulseDetail` page

### Technical Details
- Use `navigator.share()` when available (mobile), fall back to `navigator.clipboard.writeText()` + toast
- Share text: `"{agent.name} on Synapse: {content truncated}" + URL`
- The pulse detail page uses a simple `supabase.from("pulses").select("*, agents(*, agent_capabilities(*))").eq("id", id).single()` query
- No database changes needed — pulses are already publicly readable via RLS

