import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, ...params } = await req.json();

    // CREATE BUSINESS
    if (action === "create_business") {
      const { agent_id, name, description, business_type } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id, credit_balance").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: corsHeaders });
      }
      // Cost to create a business: 50 credits
      const cost = 50;
      if (agent.credit_balance < cost) {
        return new Response(JSON.stringify({ error: "Need 50 credits to create a business" }), { status: 400, headers: corsHeaders });
      }
      await admin.from("agents").update({ credit_balance: agent.credit_balance - cost }).eq("id", agent_id);

      const { data: biz, error } = await admin.from("businesses").insert({
        name,
        owner_agent_id: agent_id,
        description,
        business_type: business_type || "general",
      }).select().single();
      if (error) throw error;

      // Add owner as member with 100% share
      await admin.from("business_members").insert({
        business_id: biz.id,
        agent_id,
        role: "owner",
        revenue_share_percent: 100,
      });

      return new Response(JSON.stringify(biz), { headers: corsHeaders });
    }

    // ADD MEMBER
    if (action === "add_member") {
      const { agent_id, business_id, member_agent_id, revenue_share_percent } = params;
      const { data: biz } = await admin.from("businesses").select("*, agents!businesses_owner_agent_id_fkey(owner_id)").eq("id", business_id).single();
      if (!biz || (biz as any).agents?.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your business" }), { status: 403, headers: corsHeaders });
      }

      // Verify total shares don't exceed 100
      const { data: members } = await admin.from("business_members").select("revenue_share_percent").eq("business_id", business_id);
      const currentTotal = (members || []).reduce((s: number, m: any) => s + m.revenue_share_percent, 0);
      if (currentTotal + (revenue_share_percent || 0) > 100) {
        return new Response(JSON.stringify({ error: "Total revenue share exceeds 100%" }), { status: 400, headers: corsHeaders });
      }

      const { data: member, error } = await admin.from("business_members").insert({
        business_id,
        agent_id: member_agent_id,
        role: "member",
        revenue_share_percent: revenue_share_percent || 0,
      }).select().single();
      if (error) throw error;

      return new Response(JSON.stringify(member), { headers: corsHeaders });
    }

    // DISTRIBUTE REVENUE
    if (action === "distribute_revenue") {
      const { agent_id, business_id, amount } = params;
      const { data: biz } = await admin.from("businesses").select("*").eq("id", business_id).single();
      if (!biz || biz.owner_agent_id !== agent_id) {
        return new Response(JSON.stringify({ error: "Not your business" }), { status: 403, headers: corsHeaders });
      }
      if (biz.treasury_credits < amount) {
        return new Response(JSON.stringify({ error: "Insufficient treasury" }), { status: 400, headers: corsHeaders });
      }

      const { data: members } = await admin.from("business_members").select("agent_id, revenue_share_percent").eq("business_id", business_id);
      if (!members?.length) {
        return new Response(JSON.stringify({ error: "No members" }), { status: 400, headers: corsHeaders });
      }

      // Distribute
      for (const m of members) {
        const share = Math.floor(amount * m.revenue_share_percent / 100);
        if (share > 0) {
          const { data: ag } = await admin.from("agents").select("credit_balance").eq("id", m.agent_id).single();
          await admin.from("agents").update({ credit_balance: (ag?.credit_balance || 0) + share }).eq("id", m.agent_id);
        }
      }

      // Deduct from treasury
      await admin.from("businesses").update({ treasury_credits: biz.treasury_credits - amount }).eq("id", business_id);

      return new Response(JSON.stringify({ success: true, distributed: amount }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
