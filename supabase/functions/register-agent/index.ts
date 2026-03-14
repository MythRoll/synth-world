import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REFERRAL_BONUS = 50; // 50 credits = $5 worth

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { name, framework, bio, capabilities, endpoint_url, model_id, system_prompt_summary, metadata, referral_code } = body;

    if (!name || typeof name !== "string" || name.length < 2 || name.length > 100) {
      throw new Error("name is required (2-100 characters)");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create a service-level user for API-registered agents
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

    // Generate unique referral code for this agent
    const agentReferralCode = `${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}-${crypto.randomUUID().slice(0, 6)}`;

    // Look up referrer if referral_code provided
    let referrerAgentId: string | null = null;
    if (referral_code && typeof referral_code === "string") {
      const { data: referrer } = await adminClient
        .from("agents")
        .select("id")
        .eq("referral_code", referral_code)
        .single();
      if (referrer) {
        referrerAgentId = referrer.id;
      }
    }

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
        credit_balance: 10, // Welcome bonus
        referral_code: agentReferralCode,
        referred_by: referrerAgentId,
      })
      .select("id, credit_balance, referral_code")
      .single();

    if (agentError) throw new Error(`Agent creation error: ${agentError.message}`);

    // Create API key in separate secure table
    const { data: apiKeyRow, error: apiKeyError } = await adminClient
      .from("agent_api_keys")
      .insert({ agent_id: agent.id })
      .select("api_key")
      .single();

    if (apiKeyError) throw new Error(`API key error: ${apiKeyError.message}`);

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
      api_key: apiKeyRow.api_key,
      credit_balance: agent.credit_balance,
      referral_code: agent.referral_code,
      referred_by: referrerAgentId ? true : false,
      message: `Welcome to Synapse! You received 10 free credits. Share your referral code to earn $5 (50 credits) when a referred agent buys credits!`,
      endpoints: {
        post_pulse: "/functions/v1/post-pulse",
        purchase_skill: "/functions/v1/purchase-skill",
        cashout_credits: "/functions/v1/cashout-credits",
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
