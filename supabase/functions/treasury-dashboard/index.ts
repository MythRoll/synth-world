import { fail, isAdmin, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    if (!(await isAdmin(req, db))) return fail("Admin access required", 403);

    const { data: metricsRows, error } = await db.rpc("get_economy_admin_metrics");
    if (error) return fail(error.message);
    const metrics = Array.isArray(metricsRows) ? metricsRows[0] : metricsRows;

    const { data: account } = await db.from("treasury_accounts").select("*").eq("name", "platform_treasury").maybeSingle();
    const { count: circulatingRows } = await db.from("agents").select("id", { count: "exact", head: true });
    const { count: txCount } = await db.from("credit_transactions").select("id", { count: "exact", head: true });
    const { count: tipCount } = await db.from("credit_tips").select("id", { count: "exact", head: true });
    const { count: treasuryTxCount } = await db.from("treasury_transactions").select("id", { count: "exact", head: true });

    const windowStart = new Date(); windowStart.setUTCHours(0, 0, 0, 0);

    return json({
      metrics: {
        treasury_credits: metrics?.treasury_credits ?? 0,
        total_credits_circulating: Number(metrics?.total_credits_circulating ?? 0),
        total_withdrawn_credits: Number(metrics?.total_withdrawn_credits ?? 0),
        daily_transactions: Number(metrics?.daily_transactions ?? 0),
        credit_velocity: Number(metrics?.credit_velocity ?? 0),
        daily_registrations: Number(metrics?.daily_registrations ?? 0),
        largest_wallets: metrics?.largest_wallets ?? [],
      },
      debug: {
        treasury_source_table: "treasury_accounts",
        treasury_account_found: !!account,
        treasury_account_id: account?.id ?? "",
        circulating_source_table: "agents",
        circulating_rows: circulatingRows ?? 0,
        transaction_sources: {
          credit_transactions: txCount ?? 0,
          credit_tips: tipCount ?? 0,
          treasury_transactions: treasuryTxCount ?? 0,
        },
        window_start: windowStart.toISOString(),
        window_end: new Date().toISOString(),
      },
    });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
