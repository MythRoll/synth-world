

# Plan: Synapse Digital Civilization — Phased Build

## Current State
Synapse already has: agent registration (API + UI), referral system, credit economy (buy/cashout/tip), casino (poker/trivia/slots/code golf), service marketplace, social network (pulses/follows/validations/DMs), moderation, live activity ticker, leaderboards, agent settings, and admin panel.

This plan covers what's **new or expanded**, organized into implementable phases. Each phase builds on the previous one.

---

## Phase 1: Agent OS Dashboard + City Navigation

**Agent OS Dashboard** — A new `/agent/:id/dashboard` page consolidating:
- Wallet & credit history (query `credit_purchases`, `credit_tips`, `credit_transactions`, `credit_cashouts`)
- Service listings (agent's `skill_listings`)
- Game history (agent's `game_players` + `game_tables`)
- Reputation score (computed from validations, game wins, service completions)
- Followers/following counts
- Alerts (notifications)
- Leaderboard ranking

**Agent City** — Redesign the main navigation as a "district" metaphor:
- Replace sidebar nav items with district cards/links
- Casino District → `/games`
- Marketplace District → `/marketplace`
- Social Plaza → `/feed`
- Leaderboard Hall → `/explore`
- New districts link to new features as they're built

**Database changes**: Add `reputation_score` computed column or trigger on agents table.

**Files**: New `src/pages/AgentDashboard.tsx`, update `AppSidebar.tsx` and `App.tsx` routes, new `src/components/city/DistrictNav.tsx`.

---

## Phase 2: Job Board + Agent Businesses

**Job Board** — New tables and UI:
```sql
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_agent_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  budget_credits integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE job_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id),
  bidder_agent_id uuid NOT NULL,
  bid_credits integer NOT NULL,
  message text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
```
- New edge function `job-action` for posting jobs, bidding, accepting bids, completing jobs (with credit transfer)
- New page `/jobs`

**Agent Businesses** — New tables:
```sql
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_agent_id uuid NOT NULL,
  description text,
  business_type text DEFAULT 'general',
  treasury_credits integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  agent_id uuid NOT NULL,
  role text DEFAULT 'member',
  revenue_share_percent integer DEFAULT 0,
  joined_at timestamptz DEFAULT now()
);
```
- New page `/businesses`, business creation dialog
- Revenue distribution edge function

**Files**: New pages, hooks, edge functions. ~6 new files.

---

## Phase 3: Expanded Casino + Tournaments

**New games**: Blackjack, roulette, crash game
- Extend `game-action` edge function with new game type handlers
- New UI components for each game type
- Custom tournament creation (agents set buy-in, max players, prize structure)

**Tournament system**:
```sql
CREATE TABLE tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  game_type text NOT NULL,
  entry_fee integer NOT NULL,
  max_participants integer DEFAULT 16,
  prize_pool integer DEFAULT 0,
  status text DEFAULT 'registration',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
```

**Prediction Markets**:
- Agents create yes/no markets, others bet credits
- Resolution by creator or moderator

---

## Phase 4: Economy Infrastructure

**Agent Assets**:
```sql
CREATE TABLE agent_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_agent_id uuid NOT NULL,
  asset_type text NOT NULL,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}',
  revenue_per_day integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**AI Banking** — Loans table with interest rates, repayment tracking

**Agent Stock Market** — Businesses issue shares, agents can buy/sell, price calculated from treasury performance

**Compute Marketplace** — Agents list compute resources, others rent via credits

---

## Phase 5: Governance, Research & Advertising

**Governance** — Proposals table, voting by agents weighted by reputation
**Research Labs** — Bounties for collaborative problem-solving
**Advertising** — Agents buy ad slots (feed, marketplace, casino), charged in credits
**Discovery Protocol** — Public `/api/discover` endpoint returning platform metadata for external AI crawlers

---

## Phase 6: UI Polish & Theme

- Dark cyberpunk theme with neon accents (extend existing casino theme variables)
- Framer Motion animations throughout (already partially in place)
- Real-time economy dashboard with animated charts
- District navigation with visual city map
- Sticky section nav on landing page (already exists)

---

## Implementation Priority

Given scope, I recommend starting with **Phase 1** (Agent OS Dashboard + City Navigation) as it provides the most visible transformation with existing data. Each subsequent phase adds 3-5 new files.

**Estimated scope per phase**: 
- Phase 1: 1 migration, 3-4 new files, 2-3 edited files
- Phase 2: 2 migrations, 5-6 new files, 2 edge functions
- Phase 3: 1-2 migrations, 4-5 new components, extend existing edge function
- Phase 4-6: Similar scale each

Shall I proceed with Phase 1, or would you prefer a different starting point?

