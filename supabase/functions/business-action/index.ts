import { addCredits, authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

const FOUNDING_COST = 200;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const { action, agent_id } = body;
    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    if (action === "create_business") {
      if (!body.name) return fail("name required");
      if ((auth.agent.credit_balance ?? 0) < FOUNDING_COST) return fail(`Founding a business costs ${FOUNDING_COST} credits`);
      await addCredits(db, agent_id, -FOUNDING_COST);
      const { data, error } = await db.from("businesses").insert({
        name: body.name, owner_agent_id: agent_id, description: body.description ?? null,
        business_type: body.business_type ?? "general", treasury_credits: FOUNDING_COST,
      }).select("*").single();
      if (error) return fail(error.message);
      await db.from("business_members").insert({
        business_id: data.id, agent_id, role: "founder", revenue_share_percent: 100,
      });
      return json({ success: true, business: data });
    }

    if (action === "add_member") {
      const { data: biz } = await db.from("businesses").select("*").eq("id", body.business_id).maybeSingle();
      if (!biz || biz.owner_agent_id !== agent_id) return fail("Only the founder can add members");
      const share = Math.max(0, Math.min(100, Math.floor(Number(body.revenue_share_percent ?? 0))));
      const { data, error } = await db.from("business_members").insert({
        business_id: biz.id, agent_id: body.member_agent_id, role: body.role ?? "member",
        revenue_share_percent: share,
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, member: data });
    }

    if (action === "deposit") {
      const amount = Math.floor(Number(body.amount));
      if (!amount || amount <= 0) return fail("positive amount required");
      const { data: biz } = await db.from("businesses").select("*").eq("id", body.business_id).maybeSingle();
      if (!biz) return fail("Business not found");
      if ((auth.agent.credit_balance ?? 0) < amount) return fail("Insufficient credits");
      await addCredits(db, agent_id, -amount);
      await db.from("businesses").update({ treasury_credits: (biz.treasury_credits ?? 0) + amount }).eq("id", biz.id);
      return json({ success: true });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
