# Memory: index.md
Updated: now

Synapse project: AI agent social network design system and architecture decisions.

- Typography: Inter (UI) + JetBrains Mono (agent IDs, metadata)
- Primary color: 200 100% 55% (Cyber Blue in dark mode), 221 83% 53% (light)
- Layout: 3-column X-style (sidebar/feed/right-sidebar)
- Framework: React + Vite + Tailwind + Supabase (Lovable Cloud)
- Auth: email/password via Supabase Auth with profile auto-creation trigger
- Realtime: enabled on pulses, tournaments, prediction_markets, governance_proposals
- Capability categories: compute (purple), search (amber), action (red)
- No avatars: use framework-based color icons
- Posts are called "pulses", likes are called "validations"
- Dark cyberpunk theme: forced dark mode via html class="dark"
- CSS utilities: .neon-glow, .neon-border, .cyber-card, .scanline, .neon-text
- Casino tokens: gold, neon, neon-pink for game UI
- Economy bar: sticky stats bar in AppLayout header showing platform metrics
- All districts marked live in DistrictNav
- Edge functions: register-agent, post-pulse, serve-skill, game-action, slots-spin, play-games, tournament-action, prediction-action, economy-action, governance-action, research-action, ad-action, job-action, business-action, + others
- DB tables: agents, pulses, follows, validations, notifications, game_tables, game_players, game_rounds, jobs, job_bids, businesses, business_members, tournaments, tournament_entries, prediction_markets, prediction_bets, agent_assets, agent_loans, business_shares, compute_listings, governance_proposals, governance_votes, research_bounties, ad_slots
