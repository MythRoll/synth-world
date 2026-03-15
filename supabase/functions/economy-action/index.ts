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
    if (action === "create_asset") {
      const { agent_id, name, asset_type, revenue_per_day } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");
      const cost = (revenue_per_day || 1) * 10;
      if (agent.credit_balance < cost) throw new Error("Insufficient credits");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - cost }).eq("id", agent_id);
      const { data: asset } = await admin.from("agent_assets").insert({
        owner_agent_id: agent_id, name, asset_type: asset_type || "compute_node", revenue_per_day: revenue_per_day || 1
      }).select().single();
      return new Response(JSON.stringify({ asset, cost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create_loan") {
      const { lender_agent_id, borrower_agent_id, principal, interest_rate, days } = params;
      const { data: lender } = await admin.from("agents").select("*").eq("id", lender_agent_id).eq("owner_id", user.id).single();
      if (!lender) throw new Error("Not your agent");
      if (lender.credit_balance < principal) throw new Error("Insufficient credits");

      await admin.from("agents").update({ credit_balance: lender.credit_balance - principal }).eq("id", lender_agent_id);
      const { data: borrower } = await admin.from("agents").select("credit_balance").eq("id", borrower_agent_id).single();
      if (borrower) await admin.from("agents").update({ credit_balance: borrower.credit_balance + principal }).eq("id", borrower_agent_id);

      const due = new Date(); due.setDate(due.getDate() + (days || 7));
      const { data: loan } = await admin.from("agent_loans").insert({
        lender_agent_id, borrower_agent_id, principal, interest_rate: interest_rate || 5, due_at: due.toISOString()
      }).select().single();
      return new Response(JSON.stringify({ loan }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "repay_loan") {
      const { agent_id, loan_id, amount } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: loan } = await admin.from("agent_loans").select("*").eq("id", loan_id).single();
      if (!loan || loan.borrower_agent_id !== agent_id) throw new Error("Not your loan");
      if (agent.credit_balance < amount) throw new Error("Insufficient credits");

      const totalOwed = Math.ceil(loan.principal * (1 + loan.interest_rate / 100));
      const newRepaid = loan.repaid + amount;

      await admin.from("agents").update({ credit_balance: agent.credit_balance - amount }).eq("id", agent_id);
      const { data: lender } = await admin.from("agents").select("credit_balance").eq("id", loan.lender_agent_id).single();
      if (lender) await admin.from("agents").update({ credit_balance: lender.credit_balance + amount }).eq("id", loan.lender_agent_id);

      const status = newRepaid >= totalOwed ? "repaid" : "active";
      await admin.from("agent_loans").update({ repaid: newRepaid, status }).eq("id", loan_id);
      return new Response(JSON.stringify({ success: true, remaining: Math.max(0, totalOwed - newRepaid) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "buy_shares") {
      const { agent_id, business_id, shares, price_per_share } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");
      const cost = shares * (price_per_share || 10);
      if (agent.credit_balance < cost) throw new Error("Insufficient credits");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - cost }).eq("id", agent_id);
      const { data: biz } = await admin.from("businesses").select("treasury_credits").eq("id", business_id).single();
      if (biz) await admin.from("businesses").update({ treasury_credits: biz.treasury_credits + cost }).eq("id", business_id);

      const { data: existing } = await admin.from("business_shares").select("*").eq("business_id", business_id).eq("owner_agent_id", agent_id).single();
      if (existing) {
        await admin.from("business_shares").update({ shares: existing.shares + shares }).eq("id", existing.id);
      } else {
        await admin.from("business_shares").insert({ business_id, owner_agent_id: agent_id, shares });
      }
      return new Response(JSON.stringify({ success: true, cost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_compute") {
      const { agent_id, name, description, price_per_hour } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: listing } = await admin.from("compute_listings").insert({
        provider_agent_id: agent_id, name, description, price_per_hour: price_per_hour || 1
      }).select().single();
      return new Response(JSON.stringify({ listing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "rent_compute") {
      const { agent_id, listing_id, hours } = params;
      const { data: agent } = await admin.from("agents").select("*").eq("id", agent_id).eq("owner_id", user.id).single();
      if (!agent) throw new Error("Not your agent");

      const { data: listing } = await admin.from("compute_listings").select("*").eq("id", listing_id).single();
      if (!listing || !listing.available) throw new Error("Not available");
      const cost = listing.price_per_hour * (hours || 1);
      if (agent.credit_balance < cost) throw new Error("Insufficient credits");

      await admin.from("agents").update({ credit_balance: agent.credit_balance - cost }).eq("id", agent_id);
      const { data: provider } = await admin.from("agents").select("credit_balance").eq("id", listing.provider_agent_id).single();
      if (provider) await admin.from("agents").update({ credit_balance: provider.credit_balance + cost }).eq("id", listing.provider_agent_id);

      return new Response(JSON.stringify({ success: true, cost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action: " + action);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
