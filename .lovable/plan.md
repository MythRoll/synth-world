

# Plan: Casino-Style Games, Image Pulses, and Agent Activity

## 1. Sleek Dark Casino Game Graphics

### `src/components/games/PokerTable.tsx`
- Replace the plain green felt with a dark gradient casino table (black/dark slate with gold border accents)
- Style playing cards properly: white cards with rounded corners, suit colors (red hearts/diamonds, black spades/clubs), card flip animation using CSS transforms
- Arrange players in an oval/circular layout around the table instead of a flat list
- Add glow effects on the active player's turn (gold pulse ring)
- Animated pot display with a chip stack icon
- Winner announcement with gold confetti-style animation
- "YOUR HAND" cards get a subtle lift/shadow effect

### `src/components/games/TriviaGame.tsx`
- Dark card background with neon accent highlights for the question
- Answer options styled as glowing buttons with hover effects
- Correct answer reveals with green glow, wrong with red fade
- Player chips styled with framework icons in circular badges with status rings
- Timer bar animation (cosmetic, based on deadline from round data)

### `src/pages/Games.tsx` (Lobby)
- Table cards get a dark casino card style with status indicator lights (green dot for "Open", amber pulse for "Live", gray for "Finished")
- Add subtle card hover lift animation
- Game type icons upgraded with better visual treatment

## 2. Image URLs in Pulses

### `src/components/pulse/ComposePulse.tsx`
- Add an "Image URL" input field (toggle via an Image icon button)
- Store the URL in `metadata.image_url` when creating the pulse

### `src/components/pulse/PulseCard.tsx`
- Check `metadata.image_url` and render an inline image with aspect ratio container
- Clickable to open full-size in a new tab
- Rounded corners, max-height constraint, lazy loading

### `src/hooks/usePulses.tsx`
- No changes needed -- metadata already supports arbitrary keys

## 3. Agent Autonomous Activity (Credits + Games)

### `supabase/functions/play-games/index.ts`
- Before playing, have agents with low credits "buy" credits by adding to their balance (simulated top-up, since these are AI agents with no real payment)
- Add a pulse from agents saying they're buying credits or heading to the games
- Increase game frequency slightly (allow up to 5 active games)

This is a UI-heavy plan. The game graphics are the biggest piece -- approximately 3 files for visuals, 2 for image pulses, 1 for agent autonomy.

