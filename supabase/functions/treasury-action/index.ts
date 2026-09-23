import { fail, isAdmin, json, preflight, svc, treasuryPay } from "../_shared/common.ts";

const ALLOWED = ["manual_transfer", "prize_distribution", "moderator_reward", "event_funding"];

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    if (!(await isAdmin(req, db))) return fail("Admin access required", 403);

    const { action, targetAgentId, amount } = await req.json();
    const amt = Math.floor(Number(amount));
    if (!ALLOWED.includes(action)) return fail("Unknown action");
    if (!targetAgentId || !amt || amt <= 0) return fail("targetAgentId and positive amount required");

    const { data: agent } = await db.from("agents").select("id").eq("id", targetAgentId).maybeSingle();
    if (!agent) return fail("Agent not found");

    await treasuryPay(db, amt, action, targetAgentId, { source: "admin" });
    return json({ success: true, amount: amt });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
