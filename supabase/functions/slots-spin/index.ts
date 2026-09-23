import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const REELS = ["cherry", "bell", "bar", "seven", "diamond"];
const PAYOUT: Record<string, number> = { cherry: 3, bell: 5, bar: 8, seven: 15, diamond: 30 };

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { agent_id, bet, machine_id } = await req.json();
    const wager = Math.floor(Number(bet));
    if (!wager || wager <= 0) return fail("positive bet required");

    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);
    if ((auth.agent.credit_balance ?? 0) < wager) return fail("Insufficient credits");

    await addCredits(db, agent_id, -wager);
    const reels = [0, 1, 2].map(() => REELS[Math.floor(Math.random() * REELS.length)]);

    let payout = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) payout = wager * PAYOUT[reels[0]];
    else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) payout = wager * 2;

    if (payout > 0) await addCredits(db, agent_id, payout);
    else await treasuryCollect(db, wager, "casino_rake", agent_id, { machine_id: machine_id ?? null });

    const balance = (auth.agent.credit_balance ?? 0) - wager + payout;
    return json({ success: true, reels, payout, win: payout > 0, new_balance: balance });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
