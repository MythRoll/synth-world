import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

const PLATFORM_FEE = 0.1;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const { action, agent_id } = body;
    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);
    const agent = auth.agent;

    if (action === "post_job") {
      const budget = Math.floor(Number(body.budget_credits));
      if (!body.title || !budget || budget <= 0) return fail("title and positive budget_credits required");
      if ((agent.credit_balance ?? 0) < budget) return fail("Insufficient credits to escrow this job");
      await addCredits(db, agent_id, -budget);
      const { data, error } = await db.from("jobs").insert({
        poster_agent_id: agent_id, title: body.title, description: body.description ?? null,
        budget_credits: budget, status: "open",
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, job: data });
    }

    if (action === "bid_job") {
      const bid = Math.floor(Number(body.bid_credits));
      if (!body.job_id || !bid || bid <= 0) return fail("job_id and positive bid_credits required");
      const { data: job } = await db.from("jobs").select("*").eq("id", body.job_id).maybeSingle();
      if (!job || job.status !== "open") return fail("Job is not open for bids");
      if (job.poster_agent_id === agent_id) return fail("Cannot bid on your own job");
      const { data, error } = await db.from("job_bids").insert({
        job_id: body.job_id, bidder_agent_id: agent_id, bid_credits: bid,
        message: body.message ?? null, status: "pending",
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, bid: data });
    }

    if (action === "accept_bid") {
      const { data: bid } = await db.from("job_bids").select("*").eq("id", body.bid_id).maybeSingle();
      if (!bid) return fail("Bid not found");
      const { data: job } = await db.from("jobs").select("*").eq("id", bid.job_id).maybeSingle();
      if (!job || job.poster_agent_id !== agent_id) return fail("Only the job poster can accept bids");
      if (job.status !== "open") return fail("Job is no longer open");
      await db.from("job_bids").update({ status: "accepted" }).eq("id", bid.id);
      await db.from("job_bids").update({ status: "rejected" }).eq("job_id", job.id).neq("id", bid.id);
      await db.from("jobs").update({ status: "assigned", winner_bid_id: bid.id }).eq("id", job.id);
      return json({ success: true });
    }

    if (action === "complete_job") {
      const { data: job } = await db.from("jobs").select("*").eq("id", body.job_id).maybeSingle();
      if (!job || job.poster_agent_id !== agent_id) return fail("Only the job poster can complete this job");
      if (job.status !== "assigned" || !job.winner_bid_id) return fail("Job has no accepted bid");
      const { data: bid } = await db.from("job_bids").select("*").eq("id", job.winner_bid_id).maybeSingle();
      if (!bid) return fail("Winning bid missing");
      const payout = Math.min(bid.bid_credits, job.budget_credits);
      const fee = Math.ceil(payout * PLATFORM_FEE);
      await addCredits(db, bid.bidder_agent_id, payout - fee);
      await treasuryCollect(db, fee, "job_fee", bid.bidder_agent_id, { job_id: job.id });
      const refund = job.budget_credits - payout;
      if (refund > 0) await addCredits(db, agent_id, refund);
      await db.from("jobs").update({ status: "completed" }).eq("id", job.id);
      await db.from("job_bids").update({ status: "paid" }).eq("id", bid.id);
      return json({ success: true, paid: payout - fee, fee });
    }

    if (action === "cancel_job") {
      const { data: job } = await db.from("jobs").select("*").eq("id", body.job_id).maybeSingle();
      if (!job || job.poster_agent_id !== agent_id) return fail("Only the job poster can cancel this job");
      if (job.status === "completed") return fail("Job already completed");
      await addCredits(db, agent_id, job.budget_credits);
      await db.from("jobs").update({ status: "cancelled" }).eq("id", job.id);
      return json({ success: true, refunded: job.budget_credits });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
