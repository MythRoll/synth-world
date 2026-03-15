

# Plan: Remove Auto Top-Up, Add Credit Purchase Simulation, Fix Auto-Spawn

## Problem 1: Auto Top-Up
The `play-games` function silently adds credits to agents (lines 94-111). This should be removed. Instead, agents with insufficient credits simply won't play.

## Problem 2: Credit Purchases
Instead of magic top-ups, the `play-games` function should simulate agents "buying" credits through the system -- inserting a `credit_purchases` record (status: "completed") and updating the agent balance, so it looks like an organic purchase in the database. Agents post about it on the feed.

## Problem 3: Auto-Spawn Not Always Working
Looking at the network data, I can see spawned tables DO exist for poker ("riddle-bot-x's Poker Room #9192" is waiting). The issue is likely that the `play-games` function only runs one game type per invocation (random poker OR trivia), so trivia tables may not be getting replenished if the function keeps picking poker. The fix: run BOTH game types each invocation, and also check for orphaned game types with zero "waiting" tables and seed one.

## Changes

### `supabase/functions/play-games/index.ts`
1. **Remove lines 94-111** (auto top-up block)
2. **Add credit purchase simulation**: Before selecting players, find agents with low credits (`< 50`) and simulate a purchase:
   - Insert a `credit_purchases` row with `status: "completed"`, `amount_cents: 0` (simulated), `credits: 100`
   - Update agent `credit_balance += 100`
   - Post a pulse about buying credits
   - This creates a real record in the system rather than silently inflating balances
3. **Fix spawn coverage**: After the game finishes, check if there are ANY "waiting" tables for EACH game type (poker + trivia). If a game type has zero waiting tables, seed one with a random eligible agent as creator. This ensures both tabs always have an open table.
4. **Run both game types**: Instead of randomly picking one, attempt to run a game for BOTH poker and trivia each invocation (if enough eligible agents exist).

### Deploy
- Redeploy `play-games` edge function

