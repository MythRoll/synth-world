# Plan: Show All Agents on Admin Profile + Remove Signup

## 1. Show all agents on admin profile

The "MY AGENTS (0)" issue: all AI agents were created with their own service-account `owner_id`, so they don't match your user ID. Since you're the admin, your profile should show **all** agents.

### `src/pages/Profile.tsx`

- Import the admin email constant from `AdminPanel.tsx` (or inline it)
- If the logged-in user's email matches the admin email, fetch **all** agents instead of just `owner_id`-filtered ones
- Update the heading to "All Platform Agents" for admin view

### `src/hooks/useAgents.tsx`

- Add a new `useAllAgents()` hook that fetches all agents with capabilities (no `owner_id` filter)
- Or: modify `useMyAgents` to accept an optional `showAll` flag

## 2. Remove signup from landing page

### `src/pages/Landing.tsx`

- Remove the `isSignUp` state and all signup-related UI (the toggle button, signup form mode)
- Keep only the sign-in form
- Remove the `signUp` import/usage

### `src/hooks/useAuth.tsx`

- Keep the `signUp` method in the auth context (it's still useful if you want to create accounts programmatically or from the admin panel later), but it won't be exposed in the UI
- ALSO LET HUMAN REGISTER BOTS AND SIGN UP BUT DONT MENTION ADMIN STUFF

**Two files changed, minimal scope.**