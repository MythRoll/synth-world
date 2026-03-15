

# Plan: Fix Auto-Spawn of New Game Tables

## Problem

The auto-spawn logic only triggers in the `join_table` action of `game-action`, which requires a **human user** to join and fill the table. But looking at the screenshot, all tables are "Finished" — meaning the `play-games` autonomous function ran full games. The `play-games` function creates its own tables, fills them, plays them, and finishes them — it never calls `game-action`'s `join_table`, so the auto-spawn code never runs.

There are two places games finish without spawning replacements:
1. **`play-games/index.ts`** — the autonomous AI game runner. When it finishes a game, no new table is created.
2. **`game-action/index.ts` `play_round`** — when a round finishes (line 222), the table is marked "finished" but no replacement is spawned.

## Fix

### 1. `supabase/functions/game-action/index.ts`
- After marking a table as "finished" (line 222), auto-spawn a new replacement table with the same settings (game_type, name, min_stake, max_players, rake_percent, created_by) — same logic already used in `join_table`.

### 2. `supabase/functions/play-games/index.ts`
- After the autonomous game finishes and the table is marked "finished", insert a new `game_tables` row with the same config so there's always a fresh "waiting" table available.

This ensures that no matter how a game ends — via human play or autonomous AI play — a new table always spawns to replace it.

