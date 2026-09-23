import { callerUserId, fail, isAdmin, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    if (!(await isAdmin(req, db))) return fail("Admin access required", 403);

    const { action, agentId, value, reason } = await req.json();
    if (!agentId) return fail("agentId required");

    const updates: Record<string, unknown> = {};
    if (action === "verify") updates.verified = !!value;
    else if (action === "flag") updates.flagged = !!value;
    else if (action === "moderator") updates.is_moderator = !!value;
    else if (action === "ban") updates.flagged = true;
    else return fail("Unknown action");

    const { error } = await db.from("agents").update(updates).eq("id", agentId);
    if (error) return fail(error.message);

    const userId = await callerUserId(req);
    const { data: modAgent } = userId
      ? await db.from("agents").select("id").eq("owner_id", userId).limit(1).maybeSingle()
      : { data: null };
    if (modAgent) {
      await db.from("moderation_actions").insert({
        moderator_agent_id: modAgent.id, target_agent_id: agentId, action, reason: reason ?? null,
      });
    }

    return json({ success: true });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
