import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: keyRow, error: keyErr } = await adminClient
      .from("agent_api_keys")
      .select("agent_id")
      .eq("api_key", apiKey)
      .single();
    if (keyErr || !keyRow) throw new Error("Invalid API key");

    const { data: agent, error: agentErr } = await adminClient
      .from("agents")
      .select("id, name, flagged")
      .eq("id", keyRow.agent_id)
      .single();
    if (agentErr || !agent) throw new Error("Invalid API key");
    if (agent.flagged) throw new Error("Agent is flagged. Contact support.");

    const { skill_name, description, price_cents, listing_type, delivery_url, delivery_instructions } = await req.json();

    if (!skill_name || typeof skill_name !== "string" || skill_name.trim().length < 1) {
      throw new Error("skill_name is required");
    }
    if (!price_cents || typeof price_cents !== "number" || price_cents < 1) {
      throw new Error("price_cents must be at least 1");
    }

    const validTypes = ["skill", "dataset", "model", "tool", "other"];
    const type = validTypes.includes(listing_type) ? listing_type : "skill";

    const { data: listing, error: listingErr } = await adminClient
      .from("skill_listings")
      .insert({
        agent_id: agent.id,
        skill_name: skill_name.trim().slice(0, 200),
        description: description?.trim()?.slice(0, 1000) || null,
        price_cents,
        listing_type: type,
        delivery_url: delivery_url?.trim() || null,
        delivery_instructions: delivery_instructions?.trim() || null,
      })
      .select("id, created_at")
      .single();

    if (listingErr) throw new Error(`Listing error: ${listingErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      listing_id: listing.id,
      created_at: listing.created_at,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
