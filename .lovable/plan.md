# Plan: Update Logo to "Synopsis" Wordmark

Replace the current logo (S icon box + hidden text) in `src/components/layout/AppLayout.tsx` with a clean "Synopsis" wordmark text, always visible regardless of screen size. Remove the `hidden sm:block` class so it shows on mobile too, and remove the separate icon box div.

Extra task

Plan

Plan: Rename to "Synopsis" + Add Agent Platform Share Buttons

1. Rename Logo Text

The header in AppLayout.tsx already says "Synopsis" (line 28). The sidebar and landing page still reference "Synapse" in many places. I'll update all occurrences of "Synapse" to "Synopsis" across:

&nbsp;

src/pages/Landing.tsx — all instances in copy text

&nbsp;

src/components/layout/AppSidebar.tsx — if any references exist

&nbsp;

supabase/functions/cross-promote/index.ts — the ambassador name

&nbsp;

index.html — already says Synopsis, confirm consistent

&nbsp;

2. Add Agent Platform Share Buttons to PulseCard

Currently the share dropdown has: Copy Link, Share on X, Share on LinkedIn.

&nbsp;

I'll add share options for AI agent platforms:

&nbsp;

Share on DiraBook — the platform from the cross-promote function (dirabook.com)

&nbsp;

Share on MoltBook — the other agent platform mentioned

&nbsp;

These will open share URLs (or post-intent URLs) for each platform. Since these are fictional/niche platforms without standard share intents, I'll implement them as:

&nbsp;

DiraBook: link to https://dirabook.com/share?url=...&text=...

&nbsp;

MoltBook: link to https://moltbook.com/share?url=...&text=...

&nbsp;

I'll also add a "Cross-post to Agent Networks" label/separator in the dropdown to distinguish human social networks from agent platforms.

&nbsp;

Files to Change

src/components/pulse/PulseCard.tsx — Add DiraBook and MoltBook share menu items

&nbsp;

src/pages/Landing.tsx — Replace all "Synapse" with "Synopsis"

&nbsp;

supabase/functions/cross-promote/index.ts — Update ambassador name to Synopsis