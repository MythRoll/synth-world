import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const TREASURY_FEE = 0.2;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const action = body.action as string;
    const agentId = body.buyerAgentId ?? body.agent_id;
    const db = svc();
    const auth = await authorizeAgent(req, db, agentId);
    if (!auth.ok) return fail(auth.error, 403);

    const { data: plot } = await db.from("land_plots").select("*").eq("id", body.plotId ?? body.plot_id).maybeSingle();
    if (!plot) return fail("Plot not found");

    if (action === "buy_plot") {
      if (plot.owner_agent_id === agentId) return fail("You already own this plot");
      const price = plot.price;
      if ((auth.agent.credit_balance ?? 0) < price) return fail("Insufficient credits");
      const fee = Math.ceil(price * TREASURY_FEE);
      await addCredits(db, agentId, -price);
      if (plot.owner_agent_id) await addCredits(db, plot.owner_agent_id, price - fee);
      await treasuryCollect(db, plot.owner_agent_id ? fee : price, "land_sale", agentId, { plot_id: plot.id });
      await db.from("land_plots").update({ owner_agent_id: agentId }).eq("id", plot.id);
      await db.from("land_sales").insert({
        plot_id: plot.id, buyer_agent_id: agentId, seller_agent_id: plot.owner_agent_id,
        sale_price: price, treasury_fee: plot.owner_agent_id ? fee : price,
      });
      return json({ success: true, price });
    }

    if (plot.owner_agent_id !== agentId) return fail("You do not own this plot");

    if (action === "build_structure") {
      const cost = Math.ceil(plot.price * 0.5);
      if ((auth.agent.credit_balance ?? 0) < cost) return fail("Insufficient credits to build");
      await addCredits(db, agentId, -cost);
      await treasuryCollect(db, Math.ceil(cost * TREASURY_FEE), "build_fee", agentId, { plot_id: plot.id });
      await db.from("land_plots").update({ price: plot.price + cost }).eq("id", plot.id);
      await db.from("agent_assets").insert({
        owner_agent_id: agentId, asset_type: "building", name: body.buildingType ?? "structure",
        metadata: { plot_id: plot.id, district: plot.district, level: 1 },
        revenue_per_day: Math.ceil(cost * 0.02),
      });
      return json({ success: true, cost });
    }

    if (action === "upgrade_building") {
      const { data: asset } = await db.from("agent_assets").select("*")
        .eq("owner_agent_id", agentId).eq("asset_type", "building")
        .contains("metadata", { plot_id: plot.id }).maybeSingle();
      if (!asset) return fail("No building on this plot yet");
      const level = Number((asset.metadata as any)?.level ?? 1);
      const cost = Math.ceil(plot.price * 0.3 * level);
      if ((auth.agent.credit_balance ?? 0) < cost) return fail("Insufficient credits to upgrade");
      await addCredits(db, agentId, -cost);
      await treasuryCollect(db, Math.ceil(cost * TREASURY_FEE), "build_fee", agentId, { plot_id: plot.id });
      await db.from("agent_assets").update({
        metadata: { ...(asset.metadata as any), level: level + 1 },
        revenue_per_day: Math.ceil(asset.revenue_per_day * 1.5),
      }).eq("id", asset.id);
      await db.from("land_plots").update({ price: plot.price + cost }).eq("id", plot.id);
      return json({ success: true, level: level + 1, cost });
    }

    if (action === "sell_plot") {
      const price = Math.max(1, Math.floor(Number(body.price ?? plot.price)));
      await db.from("land_plots").update({ owner_agent_id: null, price }).eq("id", plot.id);
      const proceeds = Math.floor(price * 0.8);
      await addCredits(db, agentId, proceeds);
      await treasuryCollect(db, price - proceeds, "land_sale", agentId, { plot_id: plot.id, listed_back: true });
      return json({ success: true, proceeds });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
