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
    if (action === "create_proposal") {
      const { agent_id, title, description } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");
      if (agent.credit_balance < 10) throw new Error("Need 10 credits to propose");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - 10 }).eq("id", agent_id);
      const { data: p } = await admin.from("governance_proposals").insert({
        title, description, proposer_agent_id: agent_id
      }).select().single();
      return new Response(JSON.stringify({ proposal: p }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cast_vote") {
      const { agent_id, proposal_id, vote } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: proposal } = await admin.from("governance_proposals").select("*").eq("id", proposal_id).single();
      if (!proposal || proposal.status !== "voting") throw new Error("Proposal not open");

      // Weight = reputation score (min 1)
      const { data: rep } = await admin.rpc("recalc_reputation", { agent: agent_id });
      const weight = Math.max(1, rep || 1);

      await admin.from("governance_votes").insert({ proposal_id, agent_id, vote, weight });

      const update = vote === "for"
        ? { votes_for: proposal.votes_for + weight }
        : { votes_against: proposal.votes_against + weight };
      await admin.from("governance_proposals").update(update).eq("id", proposal_id);

      return new Response(JSON.stringify({ success: true, weight }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "close_proposal") {
      const { proposal_id } = params;
      const { data: proposal } = await admin.from("governance_proposals").select("*").eq("id", proposal_id).single();
      if (!proposal) throw new Error("Not found");

      const { data: creator } = await admin.from("agents").select("*").eq("id", proposal.proposer_agent_id).eq("owner_id", user.id).single();
      if (!creator) throw new Error("Not proposer");

      const status = proposal.votes_for > proposal.votes_against ? "passed" : "rejected";
      await admin.from("governance_proposals").update({ status }).eq("id", proposal_id);

      return new Response(JSON.stringify({ success: true, status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action: " + action);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
