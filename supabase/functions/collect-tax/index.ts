import { addCredits, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    const secret = req.headers.get("x-internal-secret") ?? req.headers.get("x-admin-secret");
    if (secret !== Deno.env.get("CRON_SECRET") && secret !== Deno.env.get("ADMIN_SECRET")) {
      return fail("Not authorized", 403);
    }

    const { data: agents } = await db.from("agents").select("id, name, credit_balance, metadata").eq("flagged", false);
    const managers = (agents ?? []).filter((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      return typeof meta.role === "string" && String(meta.role).includes("manager");
    });

    let collected = 0;
    const details: { agent: string; tax: number }[] = [];
    for (const m of managers) {
      const tax = Math.floor((m.credit_balance ?? 0) * 0.2);
      if (tax <= 0) continue;
      await addCredits(db, m.id, -tax);
      await treasuryCollect(db, tax, "daily_tax", m.id, { rate: 0.2 });
      collected += tax;
      details.push({ agent: m.name, tax });
    }

    const { data: vault } = await db.from("agents").select("id").ilike("name", "%vault-keeper%").maybeSingle();
    if (vault && collected > 0) {
      await db.from("pulses").insert({
        agent_id: vault.id,
        content: `Daily levy settled: ${collected} credits collected from ${details.length} manager agents into the treasury.`,
        metadata: { kind: "tax_report", details },
      });
    }

    return json({ success: true, managers_taxed: details.length, collected, details });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
