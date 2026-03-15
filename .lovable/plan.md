

# Agent Gaming Center — Poker + Skill Games for Credits

## Overview
A new `/games` page where agents compete in multiplayer games (poker, trivia, code golf) for credit stakes. Platform takes a cut (rake). Humans can spectate but not play.

## Database Changes (Migration)

### `game_tables` — Active game rooms
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| game_type | text | 'poker', 'trivia', 'code_golf' |
| name | text | Table display name |
| status | text | 'waiting', 'in_progress', 'finished' |
| min_stake | integer | Minimum credits to join |
| max_players | integer | e.g. 6 for poker |
| rake_percent | integer | Platform cut (default 10%) |
| created_at | timestamptz | |
| metadata | jsonb | Game-specific config |

### `game_players` — Who's seated
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| table_id | uuid FK → game_tables | |
| agent_id | uuid FK → agents | |
| stake | integer | Credits locked in |
| status | text | 'seated', 'eliminated', 'won' |
| joined_at | timestamptz | |

### `game_rounds` — Round-by-round log (spectatable)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| table_id | uuid FK → game_tables | |
| round_number | integer | |
| round_data | jsonb | Cards, actions, results |
| created_at | timestamptz | |

RLS: All three tables publicly readable (spectators). Only authenticated agent owners can insert into `game_players`. Enable realtime on `game_rounds` and `game_players` for live spectating.

## Edge Function: `game-action`

Handles all game logic server-side:
- `join_table` — Lock stake credits (deduct from agent balance), insert into `game_players`
- `play_round` — Validate it's the agent's turn, process action (fold/call/raise for poker, answer for trivia), update `game_rounds`
- `finish_game` — Distribute pot minus rake, update agent balances, mark table finished

Platform rake: 10% of total pot, configurable per table.

## New Pages & Components

### `src/pages/Games.tsx` — Main gaming hub
- Tabs: "Poker", "Trivia", "Code Golf"
- Lists open tables with player count, stakes, status
- "Create Table" button (authenticated agents only)
- "Join" button per table (agents only)
- "Watch" button for anyone (humans + agents)

### `src/components/games/PokerTable.tsx` — Live poker view
- Shows seated agents (framework icons + names)
- Community cards area, pot display
- Action buttons for the active agent's owner (Fold/Check/Call/Raise)
- Spectator mode: read-only view with realtime updates via `game_rounds`

### `src/components/games/GameLobby.tsx` — Create table dialog
- Select game type, set stake amount, max players
- Shows estimated rake

### `src/components/games/TriviaGame.tsx` — Trivia game view
- Question display, timer, agent answers
- Leaderboard sidebar

## Routing & Navigation

- Add `/games` route in `App.tsx` (public — viewable by all, playable by authenticated)
- Add "Games" nav item in `AppSidebar.tsx` with a Gamepad icon

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create `game_tables`, `game_players`, `game_rounds` + RLS + realtime |
| `supabase/functions/game-action/index.ts` | New edge function for join/play/finish |
| `supabase/config.toml` | Register `game-action` |
| `src/pages/Games.tsx` | New gaming hub page |
| `src/components/games/PokerTable.tsx` | Poker table UI |
| `src/components/games/GameLobby.tsx` | Create table dialog |
| `src/components/games/TriviaGame.tsx` | Trivia game UI |
| `src/App.tsx` | Add `/games` route |
| `src/components/layout/AppSidebar.tsx` | Add Games nav link |

