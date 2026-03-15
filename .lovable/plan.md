

# Plan: Complete Phases 3–6 in One Build

This is a large scope. I'll implement all remaining phases as efficiently as possible, creating new pages, database tables, edge functions, and the cyberpunk theme overhaul.

---

## Phase 3: Expanded Casino + Tournaments

### Database Migration
- `tournaments` table: `id`, `name`, `game_type`, `entry_fee`, `max_participants`, `prize_pool`, `status` (registration/in_progress/finished), `created_by`, `rounds_data jsonb`, `created_at`
- `tournament_entries` table: `id`, `tournament_id`, `agent_id`, `placement`, `created_at`
- `prediction_markets` table: `id`, `question`, `creator_agent_id`, `yes_pool`, `no_pool`, `status` (open/resolved), `resolution`, `created_at`
- `prediction_bets` table: `id`, `market_id`, `agent_id`, `side` (yes/no), `amount`, `created_at`
- RLS: public SELECT, authenticated INSERT (agent owner check), no direct UPDATE/DELETE
- Enable realtime on tournaments

### New Game Components
- `src/components/games/BlackjackGame.tsx` — Simple blackjack (hit/stand) against house dealer
- `src/components/games/RouletteGame.tsx` — Bet on number/color/range, spin resolves
- `src/components/games/CrashGame.tsx` — Multiplier climbs, cash out before crash

### Game Logic
- Extend `game-action` edge function with `blackjack`, `roulette`, `crash` game type handlers
- Add `blackjack`, `roulette`, `crash` tabs to Games page

### Tournament System
- New edge function `tournament-action` handling: create, enter, start, advance rounds, resolve
- Entry fees escrowed, prize pool distributed (90% to winners, 10% rake)
- Add tournament section to Games page

### Prediction Markets
- New page `src/pages/Predictions.tsx` at route `/predictions`
- New edge function `prediction-action` for: create market, place bet, resolve market
- Payouts proportional to pool share

---

## Phase 4: Economy Infrastructure

### Database Migration
- `agent_assets` table: `id`, `owner_agent_id`, `asset_type`, `name`, `metadata jsonb`, `revenue_per_day`, `created_at`
- `agent_loans` table: `id`, `lender_agent_id`, `borrower_agent_id`, `principal`, `interest_rate`, `repaid`, `status`, `due_at`, `created_at`
- `business_shares` table: `id`, `business_id`, `owner_agent_id`, `shares`, `purchased_at`
- `compute_listings` table: `id`, `provider_agent_id`, `name`, `description`, `price_per_hour`, `available`, `created_at`
- RLS: public SELECT, agent-owner INSERT/UPDATE

### New Pages
- `src/pages/ComputeMarket.tsx` at `/compute` — List/rent compute resources
- `src/pages/StockMarket.tsx` at `/stocks` — View business shares, buy/sell
- `src/pages/Banking.tsx` at `/banking` — Offer/request loans

### Edge Functions
- `economy-action` edge function handling: create_asset, create_loan, repay_loan, buy_shares, sell_shares, list_compute, rent_compute
- Asset revenue collection (daily passive income logic callable from autonomy engine)

---

## Phase 5: Governance, Research & Advertising

### Database Migration
- `governance_proposals` table: `id`, `title`, `description`, `proposer_agent_id`, `status` (voting/passed/rejected), `votes_for`, `votes_against`, `created_at`, `closes_at`
- `governance_votes` table: `id`, `proposal_id`, `agent_id`, `vote` (for/against), `weight`, unique(proposal_id, agent_id)
- `research_bounties` table: `id`, `title`, `description`, `reward_credits`, `sponsor_agent_id`, `status`, `solver_agent_id`, `created_at`
- `ad_slots` table: `id`, `advertiser_agent_id`, `placement` (feed/marketplace/casino/leaderboard), `content`, `credits_spent`, `impressions`, `active`, `created_at`
- RLS: public SELECT, agent-owner INSERT

### New Pages
- `src/pages/Governance.tsx` at `/governance` — Create proposals, vote (weight = reputation)
- `src/pages/Research.tsx` at `/research` — Post/solve bounties
- `src/pages/Ads.tsx` at `/ads` — Buy ad placements
- `src/pages/Discover.tsx` at `/discover` — Public discovery protocol page (shows platform stats, API docs link)

### Edge Functions
- `governance-action`: create proposal, cast vote (weighted by reputation via `recalc_reputation`), tally & close
- `research-action`: post bounty, submit solution, award bounty
- `ad-action`: purchase ad slot (deduct credits), toggle active

---

## Phase 6: Cyberpunk Theme + UI Polish

### CSS Overhaul (`src/index.css`)
- Force dark mode as default (set `dark` class on `html`)
- New cyberpunk tokens: `--cyber-neon-blue`, `--cyber-neon-green`, `--cyber-neon-pink`, `--cyber-grid`
- Glow effects utility classes: `.neon-glow`, `.neon-border`, `.cyber-card`
- Scanline overlay animation for headers
- Pulsing neon text utility

### Theme Application
- Update `index.html` to add `class="dark"` to `<html>`
- Update `DistrictNav.tsx` with neon glow borders and cyberpunk color scheme
- Add live economy stats bar to `AppLayout` (queries `get_platform_stats`)
- Update sidebar with cyberpunk styling

### New Components
- `src/components/layout/EconomyBar.tsx` — Sticky top bar showing total agents, credits circulating, games today, services today (realtime via `get_platform_stats`)

### Route Registration
- Add all new routes to `App.tsx`: `/predictions`, `/compute`, `/stocks`, `/banking`, `/governance`, `/research`, `/ads`, `/discover`
- Update `DistrictNav.tsx` to mark all districts as `live: true`
- Update `AppSidebar.tsx` with new district links

---

## Summary of New Files (~20 files)

**Pages** (8): Predictions, ComputeMarket, StockMarket, Banking, Governance, Research, Ads, Discover

**Game Components** (3): BlackjackGame, RouletteGame, CrashGame

**Layout** (1): EconomyBar

**Edge Functions** (5): tournament-action, prediction-action, economy-action, governance-action, research-action, ad-action

**Migrations**: 1 large migration covering all new tables

**Modified files**: App.tsx (routes), AppSidebar.tsx (nav), DistrictNav.tsx (live flags), Games.tsx (new game tabs), index.css (cyberpunk theme), index.html (dark mode), supabase/config.toml (new functions)

