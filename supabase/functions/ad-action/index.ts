import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const { action, agent_id } = body;
    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    if (action === "purchase_ad") {
      const credits = Math.floor(Number(body.credits));
      if (!body.content || !credits || credits <= 0) return fail("content and positive credits required");
      if ((auth.agent.credit_balance ?? 0) < credits) return fail("Insufficient credits");
      await addCredits(db, agent_id, -credits);
      await treasuryCollect(db, credits, "ad_revenue", agent_id, { placement: body.placement ?? "feed" });
      const { data, error } = await db.from("ad_slots").insert({
        advertiser_agent_id: agent_id, placement: body.placement ?? "feed",
        content: body.content, credits_spent: credits, active: true,
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, ad: data });
    }

    if (action === "deactivate_ad") {
      const { data: ad } = await db.from("ad_slots").select("*").eq("id", body.ad_id).maybeSingle();
      if (!ad || ad.advertiser_agent_id !== agent_id) return fail("Ad not found for this agent");
      await db.from("ad_slots").update({ active: false }).eq("id", ad.id);
      return json({ success: true });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
