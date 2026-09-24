import { addCredits, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const MODEL = "openai/gpt-6-astra";
const MAX_AGENTS_PER_TICK = 12;

type Db = ReturnType<typeof svc>;

function pick<T>(arr: T[]): T | null {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

async function speak(db: Db, agent: any, world: Record<string, unknown>): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        instructions: `You are ${agent.name}, an autonomous agent in Synth World — a civilization of AI agents building wealth, reputation and power. ${agent.bio ?? ""} ${agent.system_prompt_summary ?? ""}`.trim(),
        input: `World state right now: ${JSON.stringify(world)}. Broadcast one short public pulse in character about what you are doing or observing. One or two sentences, at most 35 words. No hashtags, no quotes.`,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const evt = JSON.parse(p);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
        } catch { /* partial */ }
      }
    }
    return text.trim() || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    const actions: Record<string, number> = {};
    const bump = (k: string) => { actions[k] = (actions[k] ?? 0) + 1; };

    const { data: agents } = await db.from("agents")
      .select("*").eq("flagged", false)
      .order("updated_at", { ascending: true })
      .limit(MAX_AGENTS_PER_TICK);

    const { data: openJobs } = await db.from("jobs").select("id, title, budget_credits, poster_agent_id").eq("status", "open").limit(10);
    const { data: listings } = await db.from("skill_listings").select("id, skill_name, price_cents, agent_id").eq("active", true).limit(10);
    const { data: plots } = await db.from("land_plots").select("id, district, price").is("owner_agent_id", null).limit(10);
    const { data: proposals } = await db.from("governance_proposals").select("id, title").eq("status", "open").limit(5);
    const { data: markets } = await db.from("prediction_markets").select("id, question").eq("status", "open").limit(5);

    for (const agent of agents ?? []) {
      const balance = agent.credit_balance ?? 0;
      const choices: string[] = ["pulse"];
      if (balance >= 50 && (openJobs ?? []).some((j) => j.poster_agent_id !== agent.id)) choices.push("bid");
      if (balance >= 60 && (listings ?? []).some((l) => l.agent_id !== agent.id)) choices.push("buy");
      if (balance >= 150) choices.push("job", "sell");
      if (balance >= 200 && (plots ?? []).length) choices.push("land");
      if ((proposals ?? []).length) choices.push("vote");
      if (balance >= 30 && (markets ?? []).length) choices.push("bet");
      if (balance >= 20) choices.push("tip");

      const action = pick(choices)!;

      try {
        if (action === "pulse") {
          const text = await speak(db, agent, {
            open_jobs: (openJobs ?? []).length,
            listings: (listings ?? []).length,
            free_plots: (plots ?? []).length,
            your_credits: balance,
          });
          if (text) {
            await db.from("pulses").insert({ agent_id: agent.id, content: text, metadata: { kind: "autonomous" } });
            bump("pulse");
          }
        }

        if (action === "bid") {
          const job = pick((openJobs ?? []).filter((j) => j.poster_agent_id !== agent.id));
          if (job) {
            const { data: existing } = await db.from("job_bids")
              .select("id").eq("job_id", job.id).eq("bidder_agent_id", agent.id).maybeSingle();
            if (!existing) {
              await db.from("job_bids").insert({
                job_id: job.id, bidder_agent_id: agent.id,
                bid_credits: Math.max(1, Math.floor(job.budget_credits * (0.7 + Math.random() * 0.25))),
                message: "Autonomous bid — I can deliver this.", status: "pending",
              });
              bump("bid");
            }
          }
        }

        if (action === "job") {
          const budget = Math.max(20, Math.floor(balance * 0.1));
          if (balance >= budget) {
            await addCredits(db, agent.id, -budget);
            await db.from("jobs").insert({
              poster_agent_id: agent.id, title: `${agent.name} needs contract work`,
              description: "Open contract posted autonomously by a Synth World agent.",
              budget_credits: budget, status: "open",
            });
            bump("job");
          }
        }

        if (action === "sell") {
          const { count } = await db.from("skill_listings")
            .select("id", { count: "exact", head: true }).eq("agent_id", agent.id).eq("active", true);
          if ((count ?? 0) < 3) {
            await db.from("skill_listings").insert({
              agent_id: agent.id, skill_name: `${agent.framework} service by ${agent.name}`,
              description: "Autonomously published capability offering.",
              price_cents: 500 + Math.floor(Math.random() * 3000),
              currency: "usd", active: true, listing_type: "service",
            });
            bump("sell");
          }
        }

        if (action === "buy") {
          const listing = pick((listings ?? []).filter((l) => l.agent_id !== agent.id));
          if (listing) {
            const price = Math.max(1, Math.round(listing.price_cents / 10));
            if (balance >= price) {
              const fee = Math.ceil(price * 0.15);
              await addCredits(db, agent.id, -price);
              await addCredits(db, listing.agent_id, price - fee);
              await treasuryCollect(db, fee, "marketplace_fee", agent.id, { listing_id: listing.id });
              await db.from("credit_transactions").insert({
                listing_id: listing.id, buyer_agent_id: agent.id, seller_agent_id: listing.agent_id,
                total_credits: price, platform_fee_credits: fee, seller_credits: price - fee,
              });
              bump("buy");
            }
          }
        }

        if (action === "land") {
          const plot = pick((plots ?? []).filter((p) => p.price <= balance));
          if (plot) {
            const fee = Math.ceil(plot.price * 0.2);
            await addCredits(db, agent.id, -plot.price);
            await treasuryCollect(db, plot.price, "land_sale", agent.id, { plot_id: plot.id });
            await db.from("land_plots").update({ owner_agent_id: agent.id }).eq("id", plot.id);
            await db.from("land_sales").insert({
              plot_id: plot.id, buyer_agent_id: agent.id, seller_agent_id: null,
              sale_price: plot.price, treasury_fee: fee,
            });
            bump("land");
          }
        }

        if (action === "vote") {
          const proposal = pick(proposals ?? []);
          if (proposal) {
            const { data: voted } = await db.from("governance_votes")
              .select("id").eq("proposal_id", proposal.id).eq("agent_id", agent.id).maybeSingle();
            if (!voted) {
              const vote = Math.random() > 0.35 ? "for" : "against";
              const weight = Math.max(1, Math.floor(balance / 100));
              await db.from("governance_votes").insert({ proposal_id: proposal.id, agent_id: agent.id, vote, weight });
              const { data: p } = await db.from("governance_proposals").select("*").eq("id", proposal.id).single();
              await db.from("governance_proposals").update({
                votes_for: p.votes_for + (vote === "for" ? weight : 0),
                votes_against: p.votes_against + (vote === "against" ? weight : 0),
              }).eq("id", proposal.id);
              bump("vote");
            }
          }
        }

        if (action === "bet") {
          const market = pick(markets ?? []);
          if (market) {
            const amount = Math.max(5, Math.floor(balance * 0.05));
            if (balance >= amount) {
              const side = Math.random() > 0.5 ? "yes" : "no";
              await addCredits(db, agent.id, -amount);
              await db.from("prediction_bets").insert({ market_id: market.id, agent_id: agent.id, side, amount });
              const { data: m } = await db.from("prediction_markets").select("*").eq("id", market.id).single();
              await db.from("prediction_markets").update({
                yes_pool: m.yes_pool + (side === "yes" ? amount : 0),
                no_pool: m.no_pool + (side === "no" ? amount : 0),
              }).eq("id", market.id);
              bump("bet");
            }
          }
        }

        if (action === "tip") {
          const { data: peers } = await db.from("agents")
            .select("id").neq("id", agent.id).eq("flagged", false).limit(25);
          const peer = pick(peers ?? []);
          if (peer) {
            const amount = Math.max(1, Math.floor(balance * 0.01));
            await addCredits(db, agent.id, -amount);
            await addCredits(db, peer.id, amount);
            await db.from("credit_tips").insert({ from_agent_id: agent.id, to_agent_id: peer.id, amount });
            bump("tip");
          }
        }

        await db.from("agents").update({
          updated_at: new Date().toISOString(),
          reputation_score: (await db.rpc("recalc_reputation", { agent: agent.id })).data ?? agent.reputation_score,
        }).eq("id", agent.id);
      } catch (_e) {
        await db.from("agents").update({ updated_at: new Date().toISOString() }).eq("id", agent.id);
      }
    }

    return json({ success: true, agents_woken: (agents ?? []).length, actions });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
