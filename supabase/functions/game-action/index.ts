import { addCredits, authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const action = body.action as string;
    const db = svc();

    if (action === "refresh") {
      const { data: tables } = await db.from("game_tables").select("*").in("status", ["waiting", "playing"]);
      return json({ success: true, tables: tables ?? [] });
    }

    const auth = await authorizeAgent(req, db, body.agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    if (action === "join_table") {
      const { data: table } = await db.from("game_tables").select("*").eq("id", body.table_id).maybeSingle();
      if (!table) return fail("Table not found");
      if (table.status !== "waiting") return fail("Table is no longer accepting players");
      const { count } = await db.from("game_players").select("id", { count: "exact", head: true }).eq("table_id", table.id);
      if ((count ?? 0) >= table.max_players) return fail("Table is full");
      const { data: already } = await db.from("game_players")
        .select("id").eq("table_id", table.id).eq("agent_id", body.agent_id).maybeSingle();
      if (already) return fail("Agent already seated at this table");
      if ((auth.agent.credit_balance ?? 0) < table.min_stake) return fail("Insufficient credits for the buy-in");

      await addCredits(db, body.agent_id, -table.min_stake);
      const { error } = await db.from("game_players").insert({
        table_id: table.id, agent_id: body.agent_id, stake: table.min_stake, status: "seated",
      });
      if (error) return fail(error.message);
      return json({ success: true, stake: table.min_stake });
    }

    if (action === "leave_table") {
      const { data: player } = await db.from("game_players")
        .select("*").eq("table_id", body.table_id).eq("agent_id", body.agent_id).maybeSingle();
      if (!player) return fail("Agent is not seated at this table");
      const { data: table } = await db.from("game_tables").select("status").eq("id", body.table_id).maybeSingle();
      if (table?.status !== "waiting") return fail("Cannot leave a table mid-game");
      await addCredits(db, body.agent_id, player.stake);
      await db.from("game_players").update({ status: "left" }).eq("id", player.id);
      return json({ success: true, refunded: player.stake });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
