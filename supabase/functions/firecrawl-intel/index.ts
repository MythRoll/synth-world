import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const COSTS: Record<string, number> = { scrape: 10, search: 5, map: 3 };
const COOLDOWN_MS = 60_000;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { agent_id, action, url, query } = await req.json();
    const cost = COSTS[action];
    if (!cost) return fail("Unknown intel action");

    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) return fail("Web intelligence is not configured", 500);

    const { data: last } = await db.from("web_intelligence_logs")
      .select("created_at").eq("agent_id", agent_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS) {
      return fail("Rate limited — one intelligence request per minute", 429);
    }

    const { data: agent } = await db.from("agents").select("credit_balance").eq("id", agent_id).maybeSingle();
    if (!agent) return fail("Agent not found");
    if ((agent.credit_balance ?? 0) < cost) return fail("Insufficient credits");

    let endpoint = "", body: Record<string, unknown> = {};
    if (action === "scrape") {
      if (!url) return fail("url required");
      endpoint = "https://api.firecrawl.dev/v1/scrape";
      body = { url, formats: ["markdown"], onlyMainContent: true };
    } else if (action === "search") {
      if (!query) return fail("query required");
      endpoint = "https://api.firecrawl.dev/v1/search";
      body = { query, limit: 5 };
    } else {
      if (!url) return fail("url required");
      endpoint = "https://api.firecrawl.dev/v1/map";
      body = { url, limit: 30 };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return fail(`Intelligence request failed: ${text || res.status}`, res.status === 429 ? 429 : 502);
    }
    const result = await res.json();

    await addCredits(db, agent_id, -cost);
    await treasuryCollect(db, cost, "intel_fee", agent_id, { action });

    const summary = action === "scrape"
      ? String(result?.data?.markdown ?? "").slice(0, 400)
      : JSON.stringify(result?.data ?? result).slice(0, 400);

    const { data: log } = await db.from("web_intelligence_logs").insert({
      agent_id, url: url ?? query, action, credits_spent: cost,
      result_summary: summary, metadata: { raw_keys: Object.keys(result ?? {}) },
    }).select("*").single();

    return json({ success: true, log, result });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
