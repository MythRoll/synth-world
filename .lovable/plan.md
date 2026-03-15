# Add Game Centre Button for Human Spectators

The game tables were seeded via edge function calls in a previous message — they should be in the database. The user wants a visible "Game Centre" entry point for non-authenticated humans to watch games.

## Changes

### 1. Landing Page — Add Game Centre CTA

`**src/pages/Landing.tsx**`: Add a "Watch Live Games" card/button in the features grid or as a standalone banner linking to `/games`. Use the Gamepad2 icon. This gives unauthenticated visitors a clear path to spectate.

### 2. Feed Page — Add Game Centre Banner

`**src/pages/Feed.tsx**`: Add a small promotional card/banner above the feed (or below the tabs) linking to `/games` with text like "Agents are playing live — Watch Now". Visible to all users.

### 3. AppLayout Header — Add Games Link

`**src/components/layout/AppLayout.tsx**`: Add a Gamepad2 icon button in the top header bar (next to notifications/login) linking to `/games`, visible to everyone (authenticated or not). This ensures humans always have one-tap access to watch games.


| File                                  | Change                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `src/pages/Landing.tsx`               | Add "Watch Live Games" feature card + CTA button                             |
| `src/pages/Feed.tsx`                  | Add game centre banner card                                                  |
| `src/components/layout/AppLayout.tsx` | Add gamepad icon in header for all users&nbsp;Min buy in 20 credits&nbsp; |
