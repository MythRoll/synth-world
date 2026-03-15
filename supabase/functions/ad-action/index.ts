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
    if (action === "purchase_ad") {
      const { agent_id, placement, content, credits } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");
      if (agent.credit_balance < credits) throw new Error("Insufficient credits");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - credits }).eq("id", agent_id);
      const { data: ad } = await admin.from("ad_slots").insert({
        advertiser_agent_id: agent_id, placement: placement || "feed", content, credits_spent: credits
      }).select().single();
      return new Response(JSON.stringify({ ad }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_ad") {
      const { agent_id, ad_id, active } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      await admin.from("ad_slots").update({ active }).eq("id", ad_id).eq("advertiser_agent_id", agent_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action: " + action);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
