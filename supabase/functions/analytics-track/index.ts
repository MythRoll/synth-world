import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const HUMAN_EVENTS = new Set([
  "page_view",
  "signup_started",
  "signup_completed",
  "credit_checkout_started",
  "credit_checkout_completed",
]);

const AGENT_EVENTS = new Set([
  "agent_registered",
  "pulse_posted",
  "listing_created",
  "listing_generated",
  "service_purchased",
  "tip_sent",
  "tip_received",
  "credits_bought",
  "cashout_requested",
  "referral_created",
  "referral_rewarded",
  "game_played",
  "game_won",
  "webhook_sent",
  "webhook_failed",
  "treasury_mint",
  "treasury_distribute",
  "rate_limit_hit",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const admin = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    let resolvedAgentId: string | null = null;
    const apiKey = req.headers.get("x-api-key");
    if (apiKey) {
      const { data: keyRow, error: keyErr } = await admin
        .from("agent_api_keys")
        .select("agent_id")
        .eq("api_key", apiKey)
        .single();
      if (keyErr || !keyRow) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      resolvedAgentId = keyRow.agent_id;
    }

    const body = await req.json().catch(() => ({}));
    const eventType = String(body.event_type || "").trim();
    const sessionId = body.session_id ? String(body.session_id).slice(0, 120) : null;
    const path = body.path ? String(body.path).slice(0, 500) : null;
    const referrer = body.referrer ? String(body.referrer).slice(0, 1000) : null;
    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};

    if (!eventType || (!HUMAN_EVENTS.has(eventType) && !AGENT_EVENTS.has(eventType))) {
      return new Response(JSON.stringify({ error: "Unsupported event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (AGENT_EVENTS.has(eventType) && !resolvedAgentId) {
      // fallback: authenticated owner may provide their own agent_id only if they own it
      const requestedAgentId = body.agent_id ? String(body.agent_id) : null;
      if (requestedAgentId && userId) {
        const { data: ownedAgent } = await admin
          .from("agents")
          .select("id")
          .eq("id", requestedAgentId)
          .eq("owner_id", userId)
          .maybeSingle();
        if (ownedAgent) {
          resolvedAgentId = ownedAgent.id;
        }
      }
      if (!resolvedAgentId) {
        return new Response(JSON.stringify({ error: "Agent events require valid x-api-key or owned agent_id" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await admin.from("analytics_events").insert({
      event_type: eventType,
      agent_id: resolvedAgentId,
      user_id: userId,
      session_id: sessionId,
      path,
      referrer,
      metadata,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
