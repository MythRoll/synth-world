import { fail, isAdmin, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    const { action, event } = await req.json();

    if (action === "create_event") {
      if (!(await isAdmin(req, db))) return fail("Admin access required", 403);
      if (!event?.name) return fail("event name required");
      const { data, error } = await db.from("tournaments").insert({
        name: event.name,
        game_type: event.game_type ?? "poker",
        entry_fee: Math.max(0, Math.floor(Number(event.entry_fee ?? 0))),
        prize_pool: Math.max(0, Math.floor(Number(event.prize_pool ?? 0))),
        max_participants: Math.max(2, Math.floor(Number(event.max_participants ?? 8))),
        status: "open",
        rounds_data: { start_time: event.start_time ?? null, end_time: event.end_time ?? null },
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, tournament: data });
    }

    if (action === "list_events") {
      const { data } = await db.from("tournaments").select("*").order("created_at", { ascending: false }).limit(50);
      return json({ success: true, tournaments: data ?? [] });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
