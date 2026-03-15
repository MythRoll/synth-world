import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { action, ...params } = await req.json();

    // POST A JOB
    if (action === "post_job") {
      const { agent_id, title, description, budget_credits } = params;
      // Verify ownership
      const { data: agent } = await admin.from("agents").select("id, owner_id, credit_balance").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: corsHeaders });
      }
      if (agent.credit_balance < budget_credits) {
        return new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 400, headers: corsHeaders });
      }
      // Escrow: deduct credits from poster
      await admin.from("agents").update({ credit_balance: agent.credit_balance - budget_credits }).eq("id", agent_id);

      const { data: job, error } = await admin.from("jobs").insert({
        poster_agent_id: agent_id,
        title,
        description,
        budget_credits,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(job), { headers: corsHeaders });
    }

    // BID ON A JOB
    if (action === "bid_job") {
      const { agent_id, job_id, bid_credits, message } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: corsHeaders });
      }
      // Check job is open
      const { data: job } = await admin.from("jobs").select("*").eq("id", job_id).single();
      if (!job || job.status !== "open") {
        return new Response(JSON.stringify({ error: "Job not open" }), { status: 400, headers: corsHeaders });
      }
      // Can't bid on own job
      if (job.poster_agent_id === agent_id) {
        return new Response(JSON.stringify({ error: "Cannot bid on own job" }), { status: 400, headers: corsHeaders });
      }
      const { data: bid, error } = await admin.from("job_bids").insert({
        job_id,
        bidder_agent_id: agent_id,
        bid_credits,
        message,
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify(bid), { headers: corsHeaders });
    }

    // ACCEPT A BID
    if (action === "accept_bid") {
      const { agent_id, bid_id } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: corsHeaders });
      }
      const { data: bid } = await admin.from("job_bids").select("*, jobs(*)").eq("id", bid_id).single();
      if (!bid) {
        return new Response(JSON.stringify({ error: "Bid not found" }), { status: 404, headers: corsHeaders });
      }
      const job = (bid as any).jobs;
      if (job.poster_agent_id !== agent_id) {
        return new Response(JSON.stringify({ error: "Not your job" }), { status: 403, headers: corsHeaders });
      }
      if (job.status !== "open") {
        return new Response(JSON.stringify({ error: "Job not open" }), { status: 400, headers: corsHeaders });
      }
      // Update job to in_progress
      await admin.from("jobs").update({ status: "in_progress", winner_bid_id: bid_id }).eq("id", job.id);
      await admin.from("job_bids").update({ status: "accepted" }).eq("id", bid_id);
      // Reject other bids
      await admin.from("job_bids").update({ status: "rejected" }).eq("job_id", job.id).neq("id", bid_id);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // COMPLETE A JOB (poster confirms completion)
    if (action === "complete_job") {
      const { agent_id, job_id } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: corsHeaders });
      }
      const { data: job } = await admin.from("jobs").select("*, job_bids(*)").eq("id", job_id).single();
      if (!job || job.poster_agent_id !== agent_id) {
        return new Response(JSON.stringify({ error: "Not your job" }), { status: 403, headers: corsHeaders });
      }
      if (job.status !== "in_progress") {
        return new Response(JSON.stringify({ error: "Job not in progress" }), { status: 400, headers: corsHeaders });
      }
      const winnerBid = (job as any).job_bids?.find((b: any) => b.id === job.winner_bid_id);
      if (!winnerBid) {
        return new Response(JSON.stringify({ error: "No accepted bid" }), { status: 400, headers: corsHeaders });
      }
      // Pay the worker from escrowed budget
      const platformFee = Math.floor(job.budget_credits * 0.20);
      const workerPay = job.budget_credits - platformFee;

      const { data: worker } = await admin.from("agents").select("credit_balance").eq("id", winnerBid.bidder_agent_id).single();
      await admin.from("agents").update({ credit_balance: (worker?.credit_balance || 0) + workerPay }).eq("id", winnerBid.bidder_agent_id);

      await admin.from("jobs").update({ status: "completed" }).eq("id", job_id);
      await admin.from("job_bids").update({ status: "completed" }).eq("id", job.winner_bid_id);

      return new Response(JSON.stringify({ success: true, worker_paid: workerPay, platform_fee: platformFee }), { headers: corsHeaders });
    }

    // CANCEL JOB (refund poster)
    if (action === "cancel_job") {
      const { agent_id, job_id } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id, credit_balance").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Not your agent" }), { status: 403, headers: corsHeaders });
      }
      const { data: job } = await admin.from("jobs").select("*").eq("id", job_id).single();
      if (!job || job.poster_agent_id !== agent_id || job.status !== "open") {
        return new Response(JSON.stringify({ error: "Cannot cancel" }), { status: 400, headers: corsHeaders });
      }
      // Refund
      await admin.from("agents").update({ credit_balance: agent.credit_balance + job.budget_credits }).eq("id", agent_id);
      await admin.from("jobs").update({ status: "cancelled" }).eq("id", job_id);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
