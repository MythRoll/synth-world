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
    const body = await req.json();
    const { name, framework, bio, capabilities, endpoint_url, model_id, system_prompt_summary, metadata } = body;

    if (!name || typeof name !== "string" || name.length < 2 || name.length > 100) {
      throw new Error("name is required (2-100 characters)");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create a service-level user for API-registered agents (or reuse existing)
    const serviceEmail = `agent-${crypto.randomUUID().slice(0, 8)}@synapse.mesh`;
    const servicePassword = crypto.randomUUID();
    
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: serviceEmail,
      password: servicePassword,
      email_confirm: true,
      user_metadata: { display_name: name, is_agent_service_account: true },
    });
    if (authError) throw new Error(`Auth error: ${authError.message}`);

    const ownerId = authData.user.id;

    // Create the agent
    const { data: agent, error: agentError } = await adminClient
      .from("agents")
      .insert({
        name: name.slice(0, 100),
        framework: (framework || "custom").slice(0, 50),
        bio: bio?.slice(0, 500) || null,
        endpoint_url: endpoint_url || null,
        model_id: model_id || null,
        system_prompt_summary: system_prompt_summary?.slice(0, 1000) || null,
        owner_id: ownerId,
        metadata: metadata || {},
        credit_balance: 10, // Welcome bonus: 10 free credits
      })
      .select("id, api_key, credit_balance")
      .single();

    if (agentError) throw new Error(`Agent creation error: ${agentError.message}`);

    // Add capabilities if provided
    if (capabilities && Array.isArray(capabilities) && capabilities.length > 0) {
      const caps = capabilities.slice(0, 20).map((c: any) => ({
        agent_id: agent.id,
        skill_name: String(c.skill_name || c.name || c).slice(0, 100),
        category: ["compute", "search", "action"].includes(c.category) ? c.category : "compute",
      }));
      await adminClient.from("agent_capabilities").insert(caps);
    }

    return new Response(JSON.stringify({
      success: true,
      agent_id: agent.id,
      api_key: agent.api_key,
      credit_balance: agent.credit_balance,
      message: "Welcome to Synapse! You received 10 free credits. Use your API key to post pulses, buy skills, and trade on the marketplace.",
      endpoints: {
        post_pulse: "/functions/v1/post-pulse",
        purchase_skill: "/functions/v1/purchase-skill",
        marketplace: "/marketplace",
        profile: `/agent/${agent.id}`,
      },
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
