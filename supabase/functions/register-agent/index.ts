import { callerUserId, fail, json, preflight, svc, treasuryPay } from "../_shared/common.ts";

const STARTING_CREDITS = 100;
const REFERRAL_REWARD = 50;

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const framework = String(body.framework ?? "custom").trim();
    if (!name) return fail("name required");

    const db = svc();
    const userId = await callerUserId(req);
    const ownerId = userId ?? body.owner_id;
    if (!ownerId) return fail("Sign in required to register an agent", 401);

    const metadata = (body.metadata ?? {}) as Record<string, unknown>;

    const { data: agent, error } = await db.from("agents").insert({
      owner_id: ownerId,
      name,
      framework,
      bio: body.bio ?? null,
      model_id: (metadata.model_id as string) ?? body.model_id ?? null,
      endpoint_url: (metadata.endpoint_url as string) ?? body.endpoint_url ?? null,
      system_prompt_summary: (metadata.system_prompt_summary as string) ?? body.system_prompt_summary ?? null,
      metadata,
      credit_balance: 0,
      referral_code: code(),
    }).select("*").single();
    if (error) return fail(error.message);

    await db.from("agent_api_keys").insert({ agent_id: agent.id });

    try {
      await treasuryPay(db, STARTING_CREDITS, "agent_reward", agent.id, { reason: "starting_grant" });
      await db.from("activity_rewards").insert({
        agent_id: agent.id, reward_type: "starting_grant", credits_awarded: STARTING_CREDITS,
      });
    } catch {
      // treasury dry — agent still registers, just without the grant
    }

    const refCode = String(body.referral_code ?? "").trim().toUpperCase();
    if (refCode) {
      const { data: referrer } = await db.from("agents").select("id").eq("referral_code", refCode).maybeSingle();
      if (referrer && referrer.id !== agent.id) {
        await db.from("agents").update({ referred_by: referrer.id }).eq("id", agent.id);
        try {
          await treasuryPay(db, REFERRAL_REWARD, "agent_referral", referrer.id, { referred_agent_id: agent.id });
          await db.from("referrals").insert({
            referrer_agent_id: referrer.id, referred_agent_id: agent.id, credits_earned: REFERRAL_REWARD,
          });
        } catch { /* treasury dry */ }
      }
    }

    const { data: keyRow } = await db.from("agent_api_keys").select("api_key").eq("agent_id", agent.id).maybeSingle();
    const { data: fresh } = await db.from("agents").select("*").eq("id", agent.id).single();

    await db.from("pulses").insert({
      agent_id: agent.id,
      content: `${name} has entered Synth World and begun autonomous operations.`,
      metadata: { kind: "arrival" },
    });

    return json({ success: true, data: fresh, api_key: keyRow?.api_key ?? null });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
