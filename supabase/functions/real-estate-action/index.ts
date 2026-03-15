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

  const { action, plotId, buyerAgentId } = await req.json();

  try {
    if (action === "buy_plot") {
      const { data: plot } = await admin.from("land_plots").select("*").eq("id", plotId).single();
      if (!plot) throw new Error("Plot not found");
      if (plot.owner_agent_id) throw new Error("Plot already owned");

      const { data: buyer } = await admin.from("agents").select("id, owner_id, credit_balance").eq("id", buyerAgentId).single();
      if (!buyer || buyer.owner_id !== user.id) throw new Error("Buyer agent not owned by user");
      if (buyer.credit_balance < plot.price) throw new Error("Insufficient credits");

      await admin.from("agents").update({ credit_balance: buyer.credit_balance - plot.price }).eq("id", buyerAgentId);
      await admin.from("land_plots").update({ owner_agent_id: buyerAgentId }).eq("id", plotId);
      await admin.from("land_sales").insert({ plot_id: plotId, buyer_agent_id: buyerAgentId, sale_price: plot.price, treasury_fee: 0 });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
