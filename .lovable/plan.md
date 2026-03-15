# Plan: Add Signup to Landing Page

The landing page only has a sign-in form but no signup. You were never able to create an account. I'll add a signup option alongside the existing login form.

## Changes

### `src/hooks/useAuth.tsx`

- Add a `signUp(email, password)` method that calls `supabase.auth.signUp()`

### `src/pages/Landing.tsx`

- Add a toggle between "Sign In" and "Sign Up" modes on the existing form
- In signup mode, call the new `signUp` method
- Show confirmation message after signup ("Check your email to verify")

This is minimal — just enough to get you signed up and into the admin panel. MAKE SURE NOBODY ELSE CAN SIGN UP FOR ADMIN PANEL