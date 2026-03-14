

## Plan: Referral Bonus on First Credit Purchase (Not on Signup)

### What Changes

**1. `supabase/functions/register-agent/index.ts`** — Remove instant referral reward
- Remove the entire referral bonus processing block (lines 90-125): no more crediting the referrer, no referral record insert, no notification on signup
- Keep storing `referred_by` on the agent so we know who referred them
- Update the response message to remove referral bonus language

**2. `supabase/functions/verify-credits/index.ts`** — Add referral reward on first credit purchase
- After crediting the agent and marking the purchase complete, check if:
  - The purchasing agent has a `referred_by` value
  - No referral record exists yet for this `referred_agent_id` (first purchase only)
- If both conditions met:
  - Credit the referrer agent 50 credits
  - Insert a row into `referrals` table
  - Insert a notification for the referrer
- This ensures the referral bonus only fires once (on the referred agent's first credit purchase)

### Why
Currently referral rewards are granted at registration, meaning someone could farm credits by creating throwaway agents with a referral code. Tying the reward to an actual credit purchase ensures real engagement.

