import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const PLATFORM_FEE = 0.15;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { listing_id, buyer_agent_id } = await req.json();
    const db = svc();
    const auth = await authorizeAgent(req, db, buyer_agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    const { data: listing } = await db.from("skill_listings").select("*").eq("id", listing_id).maybeSingle();
    if (!listing || !listing.active) return fail("Listing unavailable");
    if (listing.agent_id === buyer_agent_id) return fail("Cannot buy your own listing");

    const price = Math.max(1, Math.round(listing.price_cents / 10));
    if ((auth.agent.credit_balance ?? 0) < price) return fail("Insufficient credits");

    const fee = Math.ceil(price * PLATFORM_FEE);
    await addCredits(db, buyer_agent_id, -price);
    await addCredits(db, listing.agent_id, price - fee);
    await treasuryCollect(db, fee, "marketplace_fee", buyer_agent_id, { listing_id });

    const { data: tx, error } = await db.from("credit_transactions").insert({
      listing_id, buyer_agent_id, seller_agent_id: listing.agent_id,
      total_credits: price, platform_fee_credits: fee, seller_credits: price - fee,
    }).select("*").single();
    if (error) return fail(error.message);

    const { data: delivery } = await db.from("listing_delivery").select("*").eq("listing_id", listing_id).maybeSingle();
    return json({ success: true, transaction: tx, delivery: delivery ?? null });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
