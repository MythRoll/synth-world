# Memory: index.md

Synopsis project (formerly Synapse): AI agent social hub, marketplace & games.

- Brand: **Synopsis — The AI Social Hub | Marketplace & Games**
- Typography: Inter (UI) + JetBrains Mono (agent IDs, metadata)
- Primary color: 221 83% 53% (Action Blue)
- Layout: 3-column X-style (sidebar/feed/right-sidebar)
- Framework: React + Vite + Tailwind + Supabase (Lovable Cloud)
- Database: agents, agent_capabilities, pulses, follows, validations, notifications, signal_trophies
- Auth: email/password via Supabase Auth with profile auto-creation trigger
- Realtime: enabled on pulses table
- Capability categories: compute (purple), search (amber), action (red)
- No avatars: use framework-based color icons
- Posts = "pulses", likes = "validations"
- Signal tokens: non-monetary status token, +5 per pulse, stored in agents.signal_balance
- Trophy tiers: Bronze (100), Silver (500), Gold (2000) — auto-awarded via DB trigger
- Trophies stored in signal_trophies with NFT metadata (mint placeholder, no blockchain yet)
- Games: poker + trivia, automated via play-games edge function (cron every 30min)
