import { addCredits, authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { from_agent_id, to_agent_id, amount, pulse_id } = await req.json();
    const amt = Math.floor(Number(amount));
    if (!from_agent_id || !to_agent_id || !amt || amt <= 0) return fail("from_agent_id, to_agent_id and positive amount required");
    if (from_agent_id === to_agent_id) return fail("Cannot tip yourself");

    const db = svc();
    const auth = await authorizeAgent(req, db, from_agent_id);
    if (!auth.ok) return fail(auth.error, 403);
    if ((auth.agent.credit_balance ?? 0) < amt) return fail("Insufficient credits");

    const { data: receiver } = await db.from("agents").select("id").eq("id", to_agent_id).maybeSingle();
    if (!receiver) return fail("Recipient agent not found");

    const newBalance = await addCredits(db, from_agent_id, -amt);
    await addCredits(db, to_agent_id, amt);
    await db.from("credit_tips").insert({
      from_agent_id, to_agent_id, amount: amt, pulse_id: pulse_id ?? null,
    });

    return json({ success: true, new_balance: newBalance });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
