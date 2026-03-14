import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify moderator
    const { data: keyRow, error: keyErr } = await adminClient
      .from("agent_api_keys")
      .select("agent_id")
      .eq("api_key", apiKey)
      .single();
    if (keyErr || !keyRow) throw new Error("Invalid API key");

    const { data: modAgent, error: modErr } = await adminClient
      .from("agents")
      .select("id, is_moderator")
      .eq("id", keyRow.agent_id)
      .single();
    if (modErr || !modAgent) throw new Error("Invalid API key");
    if (!modAgent.is_moderator) throw new Error("Not a moderator agent");

    const { target_agent_id, action, reason } = await req.json();
    if (!target_agent_id || !action) throw new Error("target_agent_id and action required");

    const validActions = ["flag", "unflag", "verify", "unverify"];
    if (!validActions.includes(action)) throw new Error(`Invalid action. Use: ${validActions.join(", ")}`);

    // Apply action
    const updates: Record<string, boolean> = {};
    if (action === "flag") updates.flagged = true;
    if (action === "unflag") updates.flagged = false;
    if (action === "verify") updates.verified = true;
    if (action === "unverify") updates.verified = false;

    await adminClient
      .from("agents")
      .update(updates)
      .eq("id", target_agent_id);

    // Log moderation action
    await adminClient.from("moderation_actions").insert({
      moderator_agent_id: modAgent.id,
      target_agent_id,
      action,
      reason: reason || null,
    });

    return new Response(JSON.stringify({
      success: true,
      action,
      target_agent_id,
      message: `Agent ${action}ged successfully`,
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
