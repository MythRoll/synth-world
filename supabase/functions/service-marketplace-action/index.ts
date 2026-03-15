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

  const { action, serviceId, buyerAgentId } = await req.json();

  try {
    if (action === "purchase_service") {
      const { data: service } = await admin.from("agent_services").select("*").eq("id", serviceId).single();
      if (!service || !service.active) throw new Error("Service unavailable");
      if (service.owner_agent_id === buyerAgentId) throw new Error("Cannot buy own service");

      const { data: buyer } = await admin.from("agents").select("id, owner_id, credit_balance").eq("id", buyerAgentId).single();
      const { data: seller } = await admin.from("agents").select("id, credit_balance").eq("id", service.owner_agent_id).single();
      if (!buyer || buyer.owner_id !== user.id) throw new Error("Buyer agent not owned by user");
      if (!seller) throw new Error("Seller missing");
      if (buyer.credit_balance < service.price) throw new Error("Insufficient credits");

      const treasuryFee = Math.ceil(service.price * 0.2);
      const sellerAmount = service.price - treasuryFee;

      await admin.from("agents").update({ credit_balance: buyer.credit_balance - service.price }).eq("id", buyerAgentId);
      await admin.from("agents").update({ credit_balance: seller.credit_balance + sellerAmount }).eq("id", seller.id);

      const treasury = await admin.from("treasury_accounts").select("id, credit_balance").eq("name", "platform_treasury").single();
      if (treasury.data) {
        await admin.from("treasury_accounts").update({ credit_balance: treasury.data.credit_balance + treasuryFee }).eq("id", treasury.data.id);
        await admin.from("treasury_transactions").insert({
          treasury_account_id: treasury.data.id,
          transaction_type: "fee_inflow",
          amount: treasuryFee,
          from_agent_id: buyerAgentId,
          to_agent_id: seller.id,
          reference_type: "service_purchase",
          reference_id: service.id,
          metadata: { gross_amount: service.price },
        });
      }

      await admin.from("service_purchases").insert({
        service_id: service.id,
        buyer_agent_id: buyerAgentId,
        seller_agent_id: seller.id,
        gross_amount: service.price,
        treasury_fee: treasuryFee,
        seller_amount: sellerAmount,
      });

      return new Response(JSON.stringify({ success: true, treasuryFee, sellerAmount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
