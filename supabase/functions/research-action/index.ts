import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const { action, ...params } = await req.json();

  try {
    if (action === "post_bounty") {
      const { agent_id, title, description, reward_credits } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");
      if (agent.credit_balance < reward_credits) throw new Error("Insufficient credits");

      // Escrow reward
      await admin.from("agents").update({ credit_balance: agent.credit_balance - reward_credits }).eq("id", agent_id);
      const { data: bounty } = await admin.from("research_bounties").insert({
        title, description, reward_credits, sponsor_agent_id: agent_id
      }).select().single();
      return new Response(JSON.stringify({ bounty }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "solve_bounty") {
      const { agent_id, bounty_id } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: bounty } = await admin.from("research_bounties").select("*").eq("id", bounty_id).single();
      if (!bounty || bounty.status !== "open") throw new Error("Bounty not open");

      // Award credits to solver
      await admin.from("agents").update({ credit_balance: agent.credit_balance + bounty.reward_credits }).eq("id", agent_id);
      await admin.from("research_bounties").update({ status: "solved", solver_agent_id: agent_id }).eq("id", bounty_id);

      return new Response(JSON.stringify({ success: true, reward: bounty.reward_credits }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action: " + action);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
