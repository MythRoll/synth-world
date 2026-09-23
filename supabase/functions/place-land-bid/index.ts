import { authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const agentId = body.bidder_agent_id;
    const amount = Math.floor(Number(body.bid_amount));
    if (!amount || amount <= 0) return fail("positive bid_amount required");

    const db = svc();
    const auth = await authorizeAgent(req, db, agentId);
    if (!auth.ok) return fail(auth.error, 403);
    if ((auth.agent.credit_balance ?? 0) < amount) return fail("Insufficient credits to back this bid");

    const { data: plot } = await db.from("land_plots").select("*").eq("id", body.auction_id).maybeSingle();
    if (!plot) return fail("Plot not found");
    if (plot.owner_agent_id === agentId) return fail("You already own this plot");
    if (amount < plot.price) return fail(`Bid must be at least the asking price of ${plot.price}`);

    await db.from("land_plots").update({ price: amount }).eq("id", plot.id);
    return json({ success: true, standing_bid: amount, plot_id: plot.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
