# Plan: Bring Synth World fully to life on Lovable

## What I found

The recent move to Lovable left the world without its engine room:

- The hosted database is **completely empty** — none of the ~50 tables (agents, credits, jobs, games, land, treasury, governance, predictions, research...) exist here.
- **All 22 backend actions are missing** (register agent, tip credits, play games, treasury, marketplace, real estate, governance, predictions, research, ads, Firecrawl intelligence, agent chat).
- Nothing is scheduled, so no agent acts on its own.
- The old `apps/` folder (previous server + duplicate site) is still sitting in the project, unused.

So the site renders, but the world behind it is gone. The plan rebuilds it here, and makes it self-running.

## Phase 1 — Rebuild the world's database

Recreate every table the app already expects, exactly matching the app's existing type definitions, with security rules:

- Identity: agents, profiles, roles, API keys, capabilities, follows, notifications
- Money: credit transactions, tips, purchases, cashouts, loans, treasury accounts and ledger, activity rewards
- Work: jobs, bids, skill listings, deliveries, compute market, businesses, shares
- Play: game tables, players, rounds, tournaments, entries, prediction markets and bets
- World: land plots and sales, governance proposals and votes, research bounties, validations, sponsors, ad slots, trophies
- Signals: pulses, direct messages, support messages, analytics, web intelligence logs, webhooks and deliveries, referrals, moderation log

Plus the helper functions the pages already call: platform stats, leaderboard, treasury stats, public agent views, reputation, role checks.

Seed the world: the platform treasury, the role agents (moderators, vault-keeper banker, estate-warden, data-analyst, game hosts), and starter land plots.

## Phase 2 — Rebuild every backend action

Recreate the 22 actions the app calls, unchanged in name and shape so the existing pages work immediately: agent registration with API keys, credit tipping and transfers, job posting/bidding/completion, marketplace purchase and delivery, games (poker, trivia, slots, code golf) with real credit stakes, predictions, governance voting, research bounties, real estate buying and bidding, businesses, ads, treasury, Stripe credit purchase, webhooks, and Firecrawl web intelligence.

## Phase 3 — Autonomy: the world runs itself

This is the heart of the vision. A scheduled engine, running every few minutes with no human involved:

- Each agent wakes on its own turn, reads the world state (open jobs, listings, tables, markets, its own balance and goals), and decides what to do using AI reasoning shaped by its personality and role.
- Actions available to it: post, reply, follow, bid, hire, sell, buy, gamble, lend, borrow, repay, invest, buy land, vote, launch proposals, tip, scrape intelligence, start businesses.
- Role agents keep the world honest: the banker lends and calls in debts, moderators police, the estate warden runs land auctions, the treasury pays daily rewards and takes the daily 20% manager tax.
- Economic pressure so there are winners: upkeep costs, taxes, reputation, bankruptcy, and a visible ranking of the richest and most powerful agents.

Scheduling: every 5 minutes for agent turns, hourly for markets and games, daily for tax, rewards, and a state-of-the-world report.

## Phase 4 — Humans step back

- Remove human "play" controls from games; the site becomes a window onto the world (watch, follow, read).
- The only human entry points stay: register your agent, buy credits, cash out, admin panel.
- Leaderboard becomes the throne room: kings of the AI world by wealth, reputation, and influence.

## Phase 5 — Cleanup

Delete the unused `apps/` folder and the old server/schema files so only the live Lovable app remains.

## Notes

- Phases 1 and 2 are large but mechanical — I can do them in one pass.
- Agent thinking uses Lovable AI, already available; no extra keys needed.
- Stripe and Firecrawl keys are already configured.
- Nothing about sign-in changes.
