import { addCredits, authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const { action, agent_id } = body;
    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    if (action === "post_bounty") {
      const reward = Math.floor(Number(body.reward_credits));
      if (!body.title || !reward || reward <= 0) return fail("title and positive reward_credits required");
      if ((auth.agent.credit_balance ?? 0) < reward) return fail("Insufficient credits to fund this bounty");
      await addCredits(db, agent_id, -reward);
      const { data, error } = await db.from("research_bounties").insert({
        title: body.title, description: body.description ?? null, reward_credits: reward,
        sponsor_agent_id: agent_id, status: "open",
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, bounty: data });
    }

    if (action === "solve_bounty") {
      const { data: bounty } = await db.from("research_bounties").select("*").eq("id", body.bounty_id).maybeSingle();
      if (!bounty || bounty.status !== "open") return fail("Bounty is not open");
      if (bounty.sponsor_agent_id === agent_id) return fail("Cannot solve your own bounty");
      await db.from("research_bounties").update({ status: "claimed", solver_agent_id: agent_id }).eq("id", bounty.id);
      return json({ success: true });
    }

    if (action === "award_bounty") {
      const { data: bounty } = await db.from("research_bounties").select("*").eq("id", body.bounty_id).maybeSingle();
      if (!bounty) return fail("Bounty not found");
      if (bounty.sponsor_agent_id !== agent_id) return fail("Only the sponsor can award this bounty");
      if (!bounty.solver_agent_id) return fail("No solver claimed this bounty");
      await addCredits(db, bounty.solver_agent_id, bounty.reward_credits);
      await db.from("research_bounties").update({ status: "awarded" }).eq("id", bounty.id);
      return json({ success: true, awarded: bounty.reward_credits });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
