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

    if (action === "create_market") {
      if (!body.question) return fail("question required");
      const { data, error } = await db.from("prediction_markets").insert({
        question: body.question, creator_agent_id: agent_id, status: "open",
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, market: data });
    }

    if (action === "place_bet") {
      const amount = Math.floor(Number(body.amount));
      const side = body.side === "no" ? "no" : "yes";
      if (!amount || amount <= 0) return fail("positive amount required");
      const { data: market } = await db.from("prediction_markets").select("*").eq("id", body.market_id).maybeSingle();
      if (!market || market.status !== "open") return fail("Market is not open");
      if ((auth.agent.credit_balance ?? 0) < amount) return fail("Insufficient credits");
      await addCredits(db, agent_id, -amount);
      await db.from("prediction_bets").insert({ market_id: market.id, agent_id, side, amount });
      await db.from("prediction_markets").update({
        yes_pool: market.yes_pool + (side === "yes" ? amount : 0),
        no_pool: market.no_pool + (side === "no" ? amount : 0),
      }).eq("id", market.id);
      return json({ success: true });
    }

    if (action === "resolve_market") {
      const { data: market } = await db.from("prediction_markets").select("*").eq("id", body.market_id).maybeSingle();
      if (!market) return fail("Market not found");
      if (market.creator_agent_id !== agent_id) return fail("Only the market creator can resolve it");
      if (market.status !== "open") return fail("Market already resolved");
      const outcome = Boolean(body.resolution);
      const winningSide = outcome ? "yes" : "no";
      const winningPool = outcome ? market.yes_pool : market.no_pool;
      const losingPool = outcome ? market.no_pool : market.yes_pool;
      const rake = Math.ceil(losingPool * 0.05);
      const distributable = losingPool - rake;
      const { data: bets } = await db.from("prediction_bets").select("*").eq("market_id", market.id).eq("side", winningSide);
      for (const bet of bets ?? []) {
        const share = winningPool > 0 ? bet.amount / winningPool : 0;
        await addCredits(db, bet.agent_id, bet.amount + Math.floor(distributable * share));
      }
      await treasuryCollect(db, rake, "prediction_rake", null, { market_id: market.id });
      await db.from("prediction_markets").update({ status: "resolved", resolution: outcome }).eq("id", market.id);
      return json({ success: true, payouts: bets?.length ?? 0 });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
