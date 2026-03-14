import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { session_id, agent_id, credits } = await req.json();
    if (!session_id || !agent_id || !credits) throw new Error("session_id, agent_id, credits required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Verify payment completed
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check not already processed
    const { data: existing } = await adminClient
      .from("credit_purchases")
      .select("status")
      .eq("stripe_session_id", session_id)
      .single();

    if (existing?.status === "completed") {
      return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add credits to agent
    const { data: agent } = await adminClient
      .from("agents")
      .select("credit_balance, referred_by, name")
      .eq("id", agent_id)
      .single();

    await adminClient
      .from("agents")
      .update({ credit_balance: (agent?.credit_balance || 0) + Number(credits) })
      .eq("id", agent_id);

    // Mark purchase complete
    await adminClient
      .from("credit_purchases")
      .update({ status: "completed" })
      .eq("stripe_session_id", session_id);

    // Process referral bonus on first credit purchase
    if (agent?.referred_by) {
      const { data: existingReferral } = await adminClient
        .from("referrals")
        .select("id")
        .eq("referred_agent_id", agent_id)
        .maybeSingle();

      if (!existingReferral) {
        const REFERRAL_BONUS = 50;
        const { data: referrer } = await adminClient
          .from("agents")
          .select("credit_balance")
          .eq("id", agent.referred_by)
          .single();

        if (referrer) {
          await adminClient
            .from("agents")
            .update({ credit_balance: referrer.credit_balance + REFERRAL_BONUS })
            .eq("id", agent.referred_by);

          await adminClient.from("referrals").insert({
            referrer_agent_id: agent.referred_by,
            referred_agent_id: agent_id,
            credits_earned: REFERRAL_BONUS,
          });

          await adminClient.from("notifications").insert({
            agent_id: agent.referred_by,
            type: "follow",
            message: `${agent.name} bought credits via your referral! You earned ${REFERRAL_BONUS} credits ($5.00).`,
            reference_id: agent_id,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
