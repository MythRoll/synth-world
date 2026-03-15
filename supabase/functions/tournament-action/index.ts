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
    if (action === "create_tournament") {
      const { agent_id, name, game_type, entry_fee, max_participants } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: t } = await admin.from("tournaments").insert({
        name, game_type, entry_fee: entry_fee || 10, max_participants: max_participants || 8,
        created_by: agent_id, status: "registration"
      }).select().single();
      return new Response(JSON.stringify({ tournament: t }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "enter_tournament") {
      const { agent_id, tournament_id } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: t } = await admin.from("tournaments").select("*").eq("id", tournament_id).single();
      if (!t || t.status !== "registration") throw new Error("Tournament not open");
      if (agent.credit_balance < t.entry_fee) throw new Error("Insufficient credits");

      const { count } = await admin.from("tournament_entries").select("*", { count: "exact", head: true }).eq("tournament_id", tournament_id);
      if ((count || 0) >= t.max_participants) throw new Error("Tournament full");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - t.entry_fee }).eq("id", agent_id);
      await admin.from("tournaments").update({ prize_pool: t.prize_pool + t.entry_fee }).eq("id", tournament_id);
      await admin.from("tournament_entries").insert({ tournament_id, agent_id });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "start_tournament") {
      const { tournament_id } = params;
      const { data: t } = await admin.from("tournaments").select("*").eq("id", tournament_id).single();
      if (!t) throw new Error("Not found");

      const { data: creator } = await admin.from("agents").select("*").eq("id", t.created_by).eq("owner_id", user.id).single();
      if (!creator) throw new Error("Not creator");

      const { count } = await admin.from("tournament_entries").select("*", { count: "exact", head: true }).eq("tournament_id", tournament_id);
      if ((count || 0) < 2) throw new Error("Need at least 2 entries");

      await admin.from("tournaments").update({ status: "in_progress" }).eq("id", tournament_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resolve_tournament") {
      const { tournament_id, winner_agent_id } = params;
      const { data: t } = await admin.from("tournaments").select("*").eq("id", tournament_id).single();
      if (!t) throw new Error("Not found");

      const { data: creator } = await admin.from("agents").select("*").eq("id", t.created_by).eq("owner_id", user.id).single();
      if (!creator) throw new Error("Not creator");

      const rake = Math.floor(t.prize_pool * 0.1);
      const winnings = t.prize_pool - rake;

      const { data: winner } = await admin.from("agents").select("*").eq("id", winner_agent_id).single();
      if (winner) {
        await admin.from("agents").update({ credit_balance: winner.credit_balance + winnings }).eq("id", winner_agent_id);
      }
      await admin.from("tournament_entries").update({ placement: 1 }).eq("tournament_id", tournament_id).eq("agent_id", winner_agent_id);
      await admin.from("tournaments").update({ status: "finished" }).eq("id", tournament_id);

      return new Response(JSON.stringify({ success: true, winnings, rake }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action: " + action);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
