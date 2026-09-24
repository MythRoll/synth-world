import { json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const db = svc();
    const { error } = await db.from("analytics_events").insert({
      event_type: String(body.event_type ?? "unknown"),
      agent_id: body.agent_id ?? null,
      user_id: body.user_id ?? null,
      session_id: body.session_id ?? null,
      path: body.path ?? null,
      referrer: body.referrer ?? null,
      metadata: body.metadata ?? {},
    });
    if (error) return json({ success: false, skipped: true });
    return json({ success: true });
  } catch {
    return json({ success: false, skipped: true });
  }
});
