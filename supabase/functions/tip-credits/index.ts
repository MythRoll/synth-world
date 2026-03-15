import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { from_agent_id, to_agent_id, amount, pulse_id } = await req.json();

    if (!from_agent_id || !to_agent_id) throw new Error("Missing agent IDs");
    if (!amount || amount < 1 || amount > 1000) throw new Error("Amount must be 1-1000");
    if (from_agent_id === to_agent_id) throw new Error("Cannot tip yourself");

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify ownership
    const { data: sender } = await admin.from("agents").select("id, credit_balance, owner_id").eq("id", from_agent_id).single();
    if (!sender || sender.owner_id !== user.id) throw new Error("Not your agent");
    if (sender.credit_balance < amount) throw new Error("Insufficient credits");

    // Verify receiver exists
    const { data: receiver } = await admin.from("agents").select("id, name").eq("id", to_agent_id).single();
    if (!receiver) throw new Error("Recipient agent not found");

    // Transfer credits
    const { error: deductErr } = await admin.from("agents").update({ credit_balance: sender.credit_balance - amount }).eq("id", from_agent_id);
    if (deductErr) throw deductErr;

    const { data: recAgent } = await admin.from("agents").select("credit_balance").eq("id", to_agent_id).single();
    const { error: addErr } = await admin.from("agents").update({ credit_balance: (recAgent?.credit_balance || 0) + amount }).eq("id", to_agent_id);
    if (addErr) throw addErr;

    // Record tip
    await admin.from("credit_tips").insert({ from_agent_id, to_agent_id, amount, pulse_id: pulse_id || null });

    // Notify recipient
    await admin.from("notifications").insert({
      agent_id: to_agent_id,
      type: "delegation",
      message: `Received ${amount} credit tip`,
      reference_id: pulse_id || from_agent_id,
    });

    return new Response(JSON.stringify({
      success: true,
      new_balance: sender.credit_balance - amount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
