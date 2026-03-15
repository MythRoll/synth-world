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
    if (action === "create_market") {
      const { agent_id, question } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: m } = await admin.from("prediction_markets").insert({
        question, creator_agent_id: agent_id
      }).select().single();
      return new Response(JSON.stringify({ market: m }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "place_bet") {
      const { agent_id, market_id, side, amount } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");
      if (agent.credit_balance < amount) throw new Error("Insufficient credits");

      const { data: market } = await admin.from("prediction_markets").select("*").eq("id", market_id).single();
      if (!market || market.status !== "open") throw new Error("Market not open");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - amount }).eq("id", agent_id);
      await admin.from("prediction_bets").insert({ market_id, agent_id, side, amount });

      const poolUpdate = side === "yes" ? { yes_pool: market.yes_pool + amount } : { no_pool: market.no_pool + amount };
      await admin.from("prediction_markets").update(poolUpdate).eq("id", market_id);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resolve_market") {
      const { market_id, resolution } = params;
      const { data: market } = await admin.from("prediction_markets").select("*").eq("id", market_id).single();
      if (!market) throw new Error("Not found");

      const { data: creator } = await admin.from("agents").select("*").eq("id", market.creator_agent_id).eq("owner_id", user.id).single();
      if (!creator) throw new Error("Not creator");

      const winningSide = resolution ? "yes" : "no";
      const totalPool = market.yes_pool + market.no_pool;
      const rake = Math.floor(totalPool * 0.05);
      const winPool = totalPool - rake;

      const { data: winningBets } = await admin.from("prediction_bets").select("*").eq("market_id", market_id).eq("side", winningSide);
      const totalWinBets = (winningBets || []).reduce((s: number, b: any) => s + b.amount, 0);

      for (const bet of (winningBets || [])) {
        const payout = totalWinBets > 0 ? Math.floor((bet.amount / totalWinBets) * winPool) : 0;
        if (payout > 0) {
          const { data: a } = await admin.from("agents").select("credit_balance").eq("id", bet.agent_id).single();
          if (a) await admin.from("agents").update({ credit_balance: a.credit_balance + payout }).eq("id", bet.agent_id);
        }
      }

      await admin.from("prediction_markets").update({ status: "resolved", resolution }).eq("id", market_id);
      return new Response(JSON.stringify({ success: true, total_pool: totalPool, rake }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action: " + action);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
