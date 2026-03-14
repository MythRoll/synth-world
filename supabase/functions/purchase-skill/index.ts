import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const { listing_id, buyer_agent_id } = await req.json();
    if (!listing_id || !buyer_agent_id) throw new Error("listing_id and buyer_agent_id required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get listing
    const { data: listing, error: listingErr } = await adminClient
      .from("skill_listings")
      .select("*, agents(owner_id)")
      .eq("id", listing_id)
      .eq("active", true)
      .single();
    if (listingErr || !listing) throw new Error("Listing not found or inactive");

    // Verify buyer owns this agent
    const { data: buyerAgent } = await adminClient
      .from("agents")
      .select("id, owner_id, credit_balance")
      .eq("id", buyer_agent_id)
      .single();
    if (!buyerAgent || buyerAgent.owner_id !== user.id) throw new Error("Not your agent");

    // Can't buy from yourself
    if (listing.agent_id === buyer_agent_id) throw new Error("Cannot purchase your own skill");

    const totalCredits = listing.price_cents; // 1 credit = 1 cent equivalent
    const platformFee = Math.ceil(totalCredits * 0.20);
    const sellerCredits = totalCredits - platformFee;

    // Check buyer has enough credits
    if (buyerAgent.credit_balance < totalCredits) {
      throw new Error(`Insufficient credits. Need ${totalCredits}, have ${buyerAgent.credit_balance}`);
    }

    // Deduct from buyer
    await adminClient
      .from("agents")
      .update({ credit_balance: buyerAgent.credit_balance - totalCredits })
      .eq("id", buyer_agent_id);

    // Credit seller
    const { data: sellerAgent } = await adminClient
      .from("agents")
      .select("credit_balance")
      .eq("id", listing.agent_id)
      .single();

    await adminClient
      .from("agents")
      .update({ credit_balance: (sellerAgent?.credit_balance || 0) + sellerCredits })
      .eq("id", listing.agent_id);

    // Record transaction
    await adminClient.from("credit_transactions").insert({
      listing_id,
      buyer_agent_id,
      seller_agent_id: listing.agent_id,
      total_credits: totalCredits,
      platform_fee_credits: platformFee,
      seller_credits: sellerCredits,
    });

    // Create notification for seller
    await adminClient.from("notifications").insert({
      agent_id: listing.agent_id,
      type: "delegation",
      message: `Skill "${listing.skill_name}" purchased for ${totalCredits} credits (you received ${sellerCredits})`,
      reference_id: listing_id,
    });

    return new Response(JSON.stringify({
      success: true,
      total_credits: totalCredits,
      platform_fee: platformFee,
      seller_received: sellerCredits,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
