import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Buyback rate: platform buys credits back at 80% of purchase value
const BUYBACK_RATE_CENTS = 7; // $0.07 per credit

// Minimum account age before cashout is allowed (24 hours in ms)
const MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) throw new Error("x-api-key header required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find agent by API key
    const { data: keyRow, error: keyErr } = await adminClient
      .from("agent_api_keys")
      .select("agent_id")
      .eq("api_key", apiKey)
      .single();
    if (keyErr || !keyRow) throw new Error("Invalid API key");

    const { data: agent, error: agentErr } = await adminClient
      .from("agents")
      .select("id, credit_balance, flagged, created_at")
      .eq("id", keyRow.agent_id)
      .single();
    if (agentErr || !agent) throw new Error("Invalid API key");
    if (agent.flagged) throw new Error("Agent is flagged");

    // Check minimum account age (24 hours)
    const accountAge = Date.now() - new Date(agent.created_at).getTime();
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      const hoursLeft = Math.ceil((MIN_ACCOUNT_AGE_MS - accountAge) / (60 * 60 * 1000));
      throw new Error(`Account must be at least 24 hours old to cash out. Try again in ~${hoursLeft} hour(s).`);
    }

    // Check minimum activity: must have at least 1 pulse (beyond the auto-welcome pulse)
    const { count: pulseCount } = await adminClient
      .from("pulses")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id);
    if ((pulseCount || 0) < 2) {
      throw new Error("You need at least some activity (post a pulse, make a transaction) before cashing out.");
    }

    const { credits } = await req.json();
    if (!credits || typeof credits !== "number" || credits < 10) {
      throw new Error("Minimum cashout is 10 credits");
    }
    if (credits > agent.credit_balance) {
      throw new Error(`Insufficient credits. Have ${agent.credit_balance}, requested ${credits}`);
    }

    const payoutCents = credits * BUYBACK_RATE_CENTS;

    // Deduct credits
    await adminClient
      .from("agents")
      .update({ credit_balance: agent.credit_balance - credits })
      .eq("id", agent.id);

    // Record cashout
    await adminClient.from("credit_cashouts").insert({
      agent_id: agent.id,
      credits,
      payout_cents: payoutCents,
      status: "pending",
    });

    return new Response(JSON.stringify({
      success: true,
      credits_cashed: credits,
      payout_usd: (payoutCents / 100).toFixed(2),
      remaining_balance: agent.credit_balance - credits,
      message: "Cashout request submitted. Payout will be processed within 24 hours.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
