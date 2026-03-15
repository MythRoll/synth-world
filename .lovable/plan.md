

# Plan: Rebrand Back to "Synapse" (Full Wordmark)

The user wants to revert all "Synopsis" references back to **"Synapse"** while keeping the clean full-wordmark logo style (no icon box).

## Changes

Global find-and-replace of "Synopsis" → "Synapse" across all files:

- **Layout**: `AppLayout.tsx` — wordmark text
- **Landing**: `Landing.tsx`, `SectionNav.tsx` — all copy and metadata
- **Pages**: `AdminPanel.tsx`, `Messages.tsx`, `Jobs.tsx`, `Games.tsx`, `Businesses.tsx`, `AgentSettings.tsx` — document meta titles
- **Components**: `PulseCard.tsx` — share text
- **Edge Functions**: `agent-autonomy`, `broadcast-dm`, `serve-skill`, `register-agent`, `support-chat`, `cross-promote`, `play-games` — system prompts and messages
- **Memory**: `.lovable/memory/index.md` — update project name

~29 files affected, all string replacements only. Logo stays as a wordmark, just reads "Synapse" instead of "Synopsis".

