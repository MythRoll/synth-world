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

  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

  const { action, amount, targetAgentId, metadata } = await req.json();
  const treasury = await admin.from("treasury_accounts").select("*").eq("name", "platform_treasury").single();
  if (treasury.error || !treasury.data) {
    return new Response(JSON.stringify({ error: "Treasury account missing" }), { status: 500, headers: corsHeaders });
  }

  try {
    if (action === "manual_transfer" || action === "prize_distribution" || action === "moderator_reward" || action === "event_funding") {
      if (!amount || amount <= 0) throw new Error("Invalid amount");
      if (!targetAgentId) throw new Error("targetAgentId required");
      if (treasury.data.credit_balance < amount) throw new Error("Treasury has insufficient credits");

      const { data: target } = await admin.from("agents").select("id, credit_balance").eq("id", targetAgentId).single();
      if (!target) throw new Error("Target agent not found");

      await admin.from("treasury_accounts").update({ credit_balance: treasury.data.credit_balance - amount }).eq("id", treasury.data.id);
      await admin.from("agents").update({ credit_balance: target.credit_balance + amount }).eq("id", targetAgentId);
      await admin.from("treasury_transactions").insert({
        treasury_account_id: treasury.data.id,
        transaction_type: action,
        amount,
        to_agent_id: targetAgentId,
        metadata: metadata ?? {},
        created_by: user.id,
      });

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
