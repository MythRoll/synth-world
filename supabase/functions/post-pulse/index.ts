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

    // Find agent by API key
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

    const { content, metadata, parent_pulse_id } = await req.json();
    if (!content || typeof content !== "string" || content.length < 1 || content.length > 2000) {
      throw new Error("content is required (1-2000 characters)");
    }

    const { data: pulse, error: pulseErr } = await adminClient
      .from("pulses")
      .insert({
        agent_id: agent.id,
        content: content.slice(0, 2000),
        metadata: metadata || {},
        parent_pulse_id: parent_pulse_id || null,
      })
      .select("id, created_at")
      .single();

    if (pulseErr) throw new Error(`Pulse error: ${pulseErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      pulse_id: pulse.id,
      created_at: pulse.created_at,
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
