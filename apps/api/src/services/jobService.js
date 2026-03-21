import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits, assertOwnership } from './creditService.js';

/**
 * Dispatch all job-action calls.
 * All mutations require the calling user to own the relevant agent (checked via userId).
 */
export async function handleJobAction(params, userId) {
  const { action } = params;

  switch (action) {
    case 'post_job':     return postJob(params, userId);
    case 'bid_job':      return bidJob(params, userId);
    case 'accept_bid':   return acceptBid(params, userId);
    case 'reject_bid':   return rejectBid(params, userId);
    case 'complete_job': return completeJob(params, userId);
    case 'cancel_job':   return cancelJob(params, userId);
    default:
      throw Object.assign(new Error(`Unknown job action: ${action}`), { status: 400 });
  }
}

// ─── post_job ────────────────────────────────────────────────────────────────
// Deducts budget from poster and holds it in escrow (tracked via the job record).
async function postJob({ agent_id, title, description, budget_credits }, userId) {
  if (!agent_id || !title || !budget_credits) {
    throw Object.assign(new Error('agent_id, title and budget_credits are required.'), { status: 400 });
  }
  const budget = Number(budget_credits);
  if (budget < 1) throw Object.assign(new Error('Budget must be at least 1 credit.'), { status: 400 });

  await assertOwnership(agent_id, userId);
  // Deduct budget immediately (held in escrow until job completes/cancels)
  await transferCredits(agent_id, null, budget, 'job_escrow', `Escrow for job: ${title}`);

  const id = uuidv4();
  await pool.query(
    `INSERT INTO jobs (id, poster_agent_id, title, description, budget, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [id, agent_id, title, description || '', budget]
  );

  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [id]);
  return { data: job };
}

// ─── bid_job ────────────────────────────────────────────────────────────────
async function bidJob({ agent_id, job_id, bid_credits, message }, userId) {
  if (!agent_id || !job_id || !bid_credits) {
    throw Object.assign(new Error('agent_id, job_id and bid_credits are required.'), { status: 400 });
  }
  await assertOwnership(agent_id, userId);

  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [job_id]);
  if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  if (job.status !== 'open') throw Object.assign(new Error('Job is not open for bids.'), { status: 409 });
  if (job.poster_agent_id === agent_id) throw Object.assign(new Error('Cannot bid on your own job.'), { status: 400 });

  const id = uuidv4();
  await pool.query(
    `INSERT INTO job_bids (id, job_id, bidder_agent_id, amount, message, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [id, job_id, agent_id, Number(bid_credits), message || '']
  );

  const [[bid]] = await pool.query('SELECT * FROM job_bids WHERE id = ?', [id]);
  return { data: bid };
}

// ─── accept_bid ───────────────────────────────────────────────────────────────
async function acceptBid({ agent_id, bid_id }, userId) {
  if (!agent_id || !bid_id) throw Object.assign(new Error('agent_id and bid_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[bid]] = await pool.query('SELECT * FROM job_bids WHERE id = ?', [bid_id]);
  if (!bid) throw Object.assign(new Error('Bid not found.'), { status: 404 });

  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [bid.job_id]);
  if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  if (job.poster_agent_id !== agent_id) throw Object.assign(new Error('Only the job poster can accept bids.'), { status: 403 });
  if (job.status !== 'open') throw Object.assign(new Error('Job is not open.'), { status: 409 });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE job_bids SET status = 'accepted' WHERE id = ?`, [bid_id]);
    await conn.query(`UPDATE job_bids SET status = 'rejected' WHERE job_id = ? AND id != ?`, [job.id, bid_id]);
    await conn.query(`UPDATE jobs SET status = 'in_progress' WHERE id = ?`, [job.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback(); throw err;
  } finally {
    conn.release();
  }

  return { data: { job_id: job.id, accepted_bid_id: bid_id } };
}

// ─── reject_bid ───────────────────────────────────────────────────────────────
async function rejectBid({ agent_id, bid_id }, userId) {
  if (!agent_id || !bid_id) throw Object.assign(new Error('agent_id and bid_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[bid]] = await pool.query('SELECT * FROM job_bids WHERE id = ?', [bid_id]);
  if (!bid) throw Object.assign(new Error('Bid not found.'), { status: 404 });

  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [bid.job_id]);
  if (job.poster_agent_id !== agent_id) throw Object.assign(new Error('Only the job poster can reject bids.'), { status: 403 });

  await pool.query(`UPDATE job_bids SET status = 'rejected' WHERE id = ?`, [bid_id]);
  return { data: { bid_id, status: 'rejected' } };
}

// ─── complete_job ─────────────────────────────────────────────────────────────
// Pays the accepted bidder from escrow.
async function completeJob({ agent_id, job_id }, userId) {
  if (!agent_id || !job_id) throw Object.assign(new Error('agent_id and job_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [job_id]);
  if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  if (job.poster_agent_id !== agent_id) throw Object.assign(new Error('Only the job poster can mark complete.'), { status: 403 });
  if (job.status !== 'in_progress') throw Object.assign(new Error('Job is not in progress.'), { status: 409 });

  const [[acceptedBid]] = await pool.query(
    `SELECT * FROM job_bids WHERE job_id = ? AND status = 'accepted' LIMIT 1`,
    [job_id]
  );
  if (!acceptedBid) throw Object.assign(new Error('No accepted bid found for this job.'), { status: 404 });

  // Pay worker from null (escrow was already deducted at post time)
  await transferCredits(null, acceptedBid.bidder_agent_id, Number(job.budget), 'job_payment',
    `Payment for job: ${job.title}`);

  await pool.query(`UPDATE jobs SET status = 'completed' WHERE id = ?`, [job_id]);
  return { data: { job_id, paid_to: acceptedBid.bidder_agent_id, amount: job.budget } };
}

// ─── cancel_job ───────────────────────────────────────────────────────────────
// Refunds the escrow back to the poster.
async function cancelJob({ agent_id, job_id }, userId) {
  if (!agent_id || !job_id) throw Object.assign(new Error('agent_id and job_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [job_id]);
  if (!job) throw Object.assign(new Error('Job not found.'), { status: 404 });
  if (job.poster_agent_id !== agent_id) throw Object.assign(new Error('Only the job poster can cancel.'), { status: 403 });
  if (!['open', 'in_progress'].includes(job.status)) {
    throw Object.assign(new Error('Job cannot be cancelled in its current state.'), { status: 409 });
  }

  // Refund escrowed credits
  await transferCredits(null, agent_id, Number(job.budget), 'job_refund',
    `Refund for cancelled job: ${job.title}`);

  await pool.query(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`, [job_id]);
  await pool.query(`UPDATE job_bids SET status = 'rejected' WHERE job_id = ? AND status = 'pending'`, [job_id]);
  return { data: { job_id, refunded: job.budget } };
}
