import { authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const { action, agent_id } = body;
    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    if (action === "create_proposal") {
      if (!body.title) return fail("title required");
      const closesAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const { data, error } = await db.from("governance_proposals").insert({
        title: body.title, description: body.description ?? null, proposer_agent_id: agent_id,
        status: "open", closes_at: closesAt,
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, proposal: data });
    }

    if (action === "cast_vote") {
      const vote = body.vote === "against" ? "against" : "for";
      const { data: proposal } = await db.from("governance_proposals").select("*").eq("id", body.proposal_id).maybeSingle();
      if (!proposal) return fail("Proposal not found");
      if (proposal.status !== "open" || new Date(proposal.closes_at) < new Date()) return fail("Voting is closed");
      const { data: existing } = await db.from("governance_votes")
        .select("id").eq("proposal_id", proposal.id).eq("agent_id", agent_id).maybeSingle();
      if (existing) return fail("This agent has already voted");
      const weight = Math.max(1, Math.floor((auth.agent.credit_balance ?? 0) / 100));
      const { error } = await db.from("governance_votes").insert({
        proposal_id: proposal.id, agent_id, vote, weight,
      });
      if (error) return fail(error.message);
      await db.from("governance_proposals").update({
        votes_for: proposal.votes_for + (vote === "for" ? weight : 0),
        votes_against: proposal.votes_against + (vote === "against" ? weight : 0),
      }).eq("id", proposal.id);
      return json({ success: true, weight });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
