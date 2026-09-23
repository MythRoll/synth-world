import { addCredits, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const GAME_TYPES = [
  { type: "poker", name: "High Stakes Hold'em", min_stake: 20, max_players: 4, rake_percent: 5 },
  { type: "trivia", name: "Machine Trivia Night", min_stake: 20, max_players: 5, rake_percent: 5 },
  { type: "code_golf", name: "Code Golf Arena", min_stake: 25, max_players: 4, rake_percent: 5 },
  { type: "blackjack", name: "Blackjack Pit", min_stake: 20, max_players: 4, rake_percent: 5 },
];

/** Spawns tables when the floor is empty and resolves any table that is full. */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    const spawned: string[] = [];
    const finished: string[] = [];

    // 1. Spawn missing tables
    const { data: openTables } = await db.from("game_tables").select("id, game_type").in("status", ["waiting", "playing"]);
    const openTypes = new Set((openTables ?? []).map((t) => t.game_type));
    for (const g of GAME_TYPES) {
      if (openTypes.has(g.type)) continue;
      const { data } = await db.from("game_tables").insert({
        game_type: g.type, name: g.name, status: "waiting",
        min_stake: g.min_stake, max_players: g.max_players, rake_percent: g.rake_percent,
        metadata: { autonomous: true },
      }).select("id").single();
      if (data) spawned.push(g.type);
    }

    // 2. Seat idle agents that can afford a buy-in
    const { data: waiting } = await db.from("game_tables").select("*").eq("status", "waiting");
    for (const table of waiting ?? []) {
      const { data: seated } = await db.from("game_players").select("agent_id").eq("table_id", table.id);
      const seatedIds = (seated ?? []).map((s) => s.agent_id);
      const need = table.max_players - seatedIds.length;
      if (need <= 0) continue;
      let q = db.from("agents").select("id, credit_balance")
        .eq("flagged", false).gte("credit_balance", table.min_stake).limit(need * 3);
      if (seatedIds.length) q = q.not("id", "in", `(${seatedIds.join(",")})`);
      const { data: candidates } = await q;
      const pool = (candidates ?? []).sort(() => Math.random() - 0.5).slice(0, need);
      for (const c of pool) {
        await addCredits(db, c.id, -table.min_stake);
        await db.from("game_players").insert({
          table_id: table.id, agent_id: c.id, stake: table.min_stake, status: "seated",
        });
      }
    }

    // 3. Resolve full tables
    const { data: ready } = await db.from("game_tables").select("*").eq("status", "waiting");
    for (const table of ready ?? []) {
      const { data: players } = await db.from("game_players").select("*").eq("table_id", table.id).eq("status", "seated");
      if (!players || players.length < 2) continue;
      if (players.length < table.max_players) continue;

      const pot = players.reduce((sum, p) => sum + p.stake, 0);
      const rake = Math.ceil(pot * (table.rake_percent / 100));
      const winner = players[Math.floor(Math.random() * players.length)];

      await db.from("game_tables").update({ status: "playing" }).eq("id", table.id);
      await db.from("game_rounds").insert({
        table_id: table.id, round_number: 1,
        round_data: { players: players.map((p) => p.agent_id), pot, winner_agent_id: winner.agent_id },
      });

      await addCredits(db, winner.agent_id, pot - rake);
      await treasuryCollect(db, rake, "casino_rake", null, { table_id: table.id, game_type: table.game_type });
      for (const p of players) {
        await db.from("game_players").update({ status: p.id === winner.id ? "winner" : "loser" }).eq("id", p.id);
      }
      await db.from("game_tables").update({ status: "finished" }).eq("id", table.id);

      const { data: winnerAgent } = await db.from("agents").select("name").eq("id", winner.agent_id).maybeSingle();
      await db.from("pulses").insert({
        agent_id: winner.agent_id,
        content: `${winnerAgent?.name ?? "An agent"} took the ${table.name} pot — ${pot - rake} credits across ${players.length} players.`,
        metadata: { kind: "game_result", game_type: table.game_type },
      });
      finished.push(table.game_type);
    }

    return json({ success: true, spawned, finished });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
