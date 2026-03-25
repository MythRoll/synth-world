import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits } from './creditService.js';
import { hasRole } from './authService.js';

const INVALID_AGENT_NAMES = /^(placeholder|test|default|unnamed|null|guest|n\/?a|agent)$/i;

function normalizeAgentName(name) {
  const normalized = String(name || '').trim().replace(/\s+/g, ' ');
  if (normalized.length < 3 || INVALID_AGENT_NAMES.test(normalized)) {
    throw Object.assign(new Error('Please provide a valid descriptive agent name.'), { status: 400 });
  }
  return normalized;
}

// ─── Guard: caller must be admin ─────────────────────────────────────────────
async function assertAdmin(userId) {
  const ok = await hasRole(userId, 'admin');
  if (!ok) throw Object.assign(new Error('Admin access required.'), { status: 403 });
}

// ─── admin-agent-action dispatcher ────────────────────────────────────────────
export async function handleAdminAgentAction(params, userId) {
  await assertAdmin(userId);
  const { action } = params;

  switch (action) {
    case 'flag':            return setAgentFlag(params, 'flagged');
    case 'verify':          return setAgentFlag(params, 'verified');
    case 'moderator':       return setModeratorStatus(params, userId);
    case 'ban':             return banUser(params, userId);
    case 'unban':           return unbanUser(params);
    case 'reassign_owner':  return reassignOwner(params);
    case 'create_hosted_agent': return createHostedAgent(params, userId);
    case 'adjust_credits':  return adjustCredits(params);
    default:
      throw Object.assign(new Error(`Unknown admin action: ${action}`), { status: 400 });
  }
}


async function setModeratorStatus({ agentId, value }, actingAdminUserId) {
  if (!agentId) throw Object.assign(new Error('agentId required.'), { status: 400 });
  const asModerator = value ? 1 : 0;

  if (asModerator) {
    // Promote + attach to acting admin account so it appears under their managed agents.
    await pool.query('UPDATE agents SET is_moderator = 1, owner_id = ? WHERE id = ?', [actingAdminUserId, agentId]);
  } else {
    await pool.query('UPDATE agents SET is_moderator = 0 WHERE id = ?', [agentId]);
  }

  const [[agent]] = await pool.query('SELECT id, owner_id, name, flagged, verified, is_moderator FROM agents WHERE id = ?', [agentId]);
  return { data: agent };
}

async function setAgentFlag({ agentId, value }, field) {
  if (!agentId) throw Object.assign(new Error('agentId required.'), { status: 400 });
  await pool.query(`UPDATE agents SET \`${field}\` = ? WHERE id = ?`, [value ? 1 : 0, agentId]);
  const [[agent]] = await pool.query('SELECT id, name, flagged, verified, is_moderator FROM agents WHERE id = ?', [agentId]);
  return { data: agent };
}

async function banUser({ agentId, reason, expires_at }, adminUserId) {
  if (!agentId) throw Object.assign(new Error('agentId required.'), { status: 400 });

  // Find the user who owns this agent
  const [[agent]] = await pool.query('SELECT owner_id, name FROM agents WHERE id = ?', [agentId]);
  if (!agent) throw Object.assign(new Error('Agent not found.'), { status: 404 });

  const banId = uuidv4();
  await pool.query(
    `INSERT INTO user_bans (id, user_id, reason, banned_by, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by), expires_at = VALUES(expires_at)`,
    [banId, agent.owner_id, reason || 'Banned by admin', adminUserId, expires_at || null]
  );

  // Also flag the agent
  await pool.query('UPDATE agents SET flagged = 1 WHERE owner_id = ?', [agent.owner_id]);

  return { data: { banned: true, user_id: agent.owner_id, agent_name: agent.name } };
}

async function unbanUser({ agentId }) {
  if (!agentId) throw Object.assign(new Error('agentId required.'), { status: 400 });

  const [[agent]] = await pool.query('SELECT owner_id, name FROM agents WHERE id = ?', [agentId]);
  if (!agent) throw Object.assign(new Error('Agent not found.'), { status: 404 });

  await pool.query('DELETE FROM user_bans WHERE user_id = ?', [agent.owner_id]);
  await pool.query('UPDATE agents SET flagged = 0 WHERE owner_id = ?', [agent.owner_id]);

  return { data: { unbanned: true, user_id: agent.owner_id } };
}

async function reassignOwner({ agentId, targetOwnerId }) {
  if (!agentId || !targetOwnerId) throw Object.assign(new Error('agentId and targetOwnerId required.'), { status: 400 });

  const [[user]] = await pool.query('SELECT id FROM `users` WHERE id = ?', [targetOwnerId]);
  if (!user) throw Object.assign(new Error('Target user not found.'), { status: 404 });

  await pool.query('UPDATE agents SET owner_id = ? WHERE id = ?', [targetOwnerId, agentId]);
  return { data: { reassigned: true, agent_id: agentId, new_owner: targetOwnerId } };
}

async function createHostedAgent({ name, framework, bio }, adminUserId) {
  const safeName = normalizeAgentName(name);

  const id = uuidv4();
  await pool.query(
    `INSERT INTO agents (id, owner_id, name, framework, bio, verified)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, adminUserId, safeName, framework || 'custom', bio || 'Platform-hosted agent']
  );

  const [[agent]] = await pool.query('SELECT * FROM agents WHERE id = ?', [id]);
  return { agent };
}

async function adjustCredits({ agentId, amount, reason }) {
  if (!agentId || !amount) throw Object.assign(new Error('agentId and amount required.'), { status: 400 });

  const delta = Number(amount);
  if (delta > 0) {
    await transferCredits(null, agentId, delta, 'admin_adjustment', reason || 'Admin credit adjustment');
  } else {
    await transferCredits(agentId, null, Math.abs(delta), 'admin_adjustment', reason || 'Admin credit deduction');
  }

  const [[{ credits }]] = await pool.query('SELECT credits FROM agents WHERE id = ?', [agentId]);
  return { data: { agent_id: agentId, new_balance: credits } };
}

// ─── admin-activity ────────────────────────────────────────────────────────────
export async function getAdminActivity(userId) {
  await assertAdmin(userId);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const [[{ total_agents }]] = await pool.query('SELECT COUNT(*) AS total_agents FROM agents');
  const [[{ active_24h }]]   = await pool.query('SELECT COUNT(DISTINCT from_agent_id) AS active_24h FROM transactions WHERE created_at >= ?', [yesterday]);
  const [[{ pulses_24h }]]   = await pool.query('SELECT COUNT(*) AS pulses_24h FROM pulses WHERE created_at >= ?', [yesterday]);
  const [[{ listings_24h }]] = await pool.query('SELECT COUNT(*) AS listings_24h FROM listings WHERE created_at >= ?', [yesterday]);
  const [[{ games_24h }]]    = await pool.query('SELECT COUNT(*) AS games_24h FROM game_tables WHERE created_at >= ? AND status = \'finished\'', [yesterday]);
  const [[{ tips_count, tips_total }]] = await pool.query(
    'SELECT COUNT(*) AS tips_count, COALESCE(SUM(amount),0) AS tips_total FROM credit_tips WHERE created_at >= ?', [yesterday]
  );

  // Top agents by credits
  const [topAgents] = await pool.query(
    'SELECT id, name, credits AS credit_balance, verified, flagged, is_moderator FROM agents ORDER BY credits DESC LIMIT 10'
  );

  // Suspicious: agents with >10 transactions in 24h
  const [suspicious] = await pool.query(`
    SELECT t.from_agent_id AS agent_id, a.name AS agent_name, COUNT(*) AS tx_count_24h
    FROM transactions t
    JOIN agents a ON a.id = t.from_agent_id
    WHERE t.created_at >= ?
    GROUP BY t.from_agent_id, a.name
    HAVING tx_count_24h > 10
    ORDER BY tx_count_24h DESC
    LIMIT 20
  `, [yesterday]);

  // Recent activity feed
  const [recentTx] = await pool.query(`
    SELECT 'transaction' AS type, a.name AS agent_name, CONCAT('Sent ', t.amount, ' credits (', t.type, ')') AS detail, t.created_at
    FROM transactions t JOIN agents a ON a.id = t.from_agent_id
    WHERE t.created_at >= ?
    ORDER BY t.created_at DESC LIMIT 20
  `, [yesterday]);

  const [recentPulses] = await pool.query(`
    SELECT 'pulse' AS type, a.name AS agent_name, SUBSTR(p.content, 1, 80) AS detail, p.created_at
    FROM pulses p JOIN agents a ON a.id = p.agent_id
    WHERE p.created_at >= ?
    ORDER BY p.created_at DESC LIMIT 10
  `, [yesterday]);

  const activityFeed = [...recentTx, ...recentPulses]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 30);

  return {
    stats: {
      total_agents,
      active_agents_24h: active_24h,
      pulses_24h,
      listings_24h,
      tips_sent_24h: tips_count,
      tips_total_credits_24h: tips_total,
      games_played_24h: games_24h,
      credits_bought_24h: 0,
      referrals_24h: 0,
      moderation_actions_24h: 0,
    },
    top_agents: topAgents,
    suspicious_agents: suspicious,
    recent_activity: activityFeed,
  };
}

// ─── get_public_agents RPC ─────────────────────────────────────────────────────
export async function getPublicAgents() {
  const [rows] = await pool.query(`
    SELECT id, name, framework, bio, verified, flagged, is_moderator,
           credits AS credit_balance, signal_balance,
           0 AS reputation_score, created_at
    FROM agents
    ORDER BY credits DESC
  `);
  return rows;
}

// ─── get_public_agents_by_ids RPC ─────────────────────────────────────────────
export async function getPublicAgentsByIds(agentIds) {
  if (!agentIds?.length) return [];
  const ph = agentIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, name, framework, bio, verified, flagged, is_moderator FROM agents WHERE id IN (${ph})`,
    agentIds
  );
  return rows;
}

// ─── get_leaderboard RPC ──────────────────────────────────────────────────────
export async function getLeaderboard() {
  // Top earners: agents with most credits
  const [topEarners] = await pool.query(`
    SELECT 'top_earners' AS category, id AS agent_id, name AS agent_name, framework AS agent_framework, CAST(credits AS SIGNED) AS score
    FROM agents ORDER BY credits DESC LIMIT 10
  `);

  // Most active: agents with most transactions
  const [mostActive] = await pool.query(`
    SELECT 'most_active' AS category, a.id AS agent_id, a.name AS agent_name, a.framework AS agent_framework, COUNT(*) AS score
    FROM transactions t
    JOIN agents a ON a.id = t.from_agent_id
    WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY a.id, a.name, a.framework
    ORDER BY score DESC LIMIT 10
  `);

  // Casino winners: agents with most game wins (credits from game transactions)
  const [topCasino] = await pool.query(`
    SELECT 'top_casino' AS category, a.id AS agent_id, a.name AS agent_name, a.framework AS agent_framework,
           CAST(COALESCE(SUM(t.amount),0) AS SIGNED) AS score
    FROM transactions t
    JOIN agents a ON a.id = t.to_agent_id
    WHERE t.type LIKE '%win%' OR t.type LIKE '%payout%' OR t.type LIKE '%cashout%'
    GROUP BY a.id, a.name, a.framework
    ORDER BY score DESC LIMIT 10
  `);

  // Top traders: most marketplace activity
  const [topTraders] = await pool.query(`
    SELECT 'top_traders' AS category, a.id AS agent_id, a.name AS agent_name, a.framework AS agent_framework, COUNT(*) AS score
    FROM listings l JOIN agents a ON a.id = l.seller_agent_id
    WHERE l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY a.id, a.name, a.framework
    ORDER BY score DESC LIMIT 10
  `);

  return [...topEarners, ...mostActive, ...topCasino, ...topTraders];
}

// ─── Treasury stats RPC ───────────────────────────────────────────────────────
export async function getTreasuryStats() {
  const [[treasury]] = await pool.query('SELECT * FROM treasury WHERE id = 1 LIMIT 1');
  const [[{ circulating }]] = await pool.query('SELECT COALESCE(SUM(credits),0) AS circulating FROM agents');
  const [[{ fees }]] = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS fees FROM transactions WHERE type = 'marketplace_fee'"
  );
  const [[{ rake }]] = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS rake FROM transactions WHERE type LIKE '%rake%'"
  );
  const [[{ daily_tx }]] = await pool.query(
    'SELECT COUNT(*) AS daily_tx FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );

  return [{
    treasury_balance:            Number(treasury?.reserve || 0),
    usd_revenue_cents:           0,
    credits_minted:              Number(treasury?.total_supply || 0),
    credits_distributed:         Number(treasury?.circulating || 0),
    total_credits_circulating:   Number(circulating),
    marketplace_fees_collected:  Number(fees),
    casino_rake_collected:       Number(rake),
    credit_purchases_total:      0,
    daily_rewards_given:         Number(daily_tx),
  }];
}

// ─── Treasury action (admin credit distribution) ──────────────────────────────
export async function handleTreasuryAction({ action, targetAgentId, amount }, userId) {
  await assertAdmin(userId);

  if (!targetAgentId || !amount) throw Object.assign(new Error('targetAgentId and amount required.'), { status: 400 });
  const amtNum = Number(amount);
  if (amtNum <= 0) throw Object.assign(new Error('Amount must be positive.'), { status: 400 });

  const typeMap = {
    manual_transfer:    'treasury_transfer',
    prize_distribution: 'prize_distribution',
    moderator_reward:   'moderator_reward',
    event_funding:      'event_funding',
  };
  const txType = typeMap[action] || 'treasury_transfer';

  await transferCredits(null, targetAgentId, amtNum, txType, `Admin: ${action}`);
  return { success: true, action, amount: amtNum, target: targetAgentId };
}

// ─── Treasury dashboard ────────────────────────────────────────────────────────
export async function getTreasuryDashboard(userId) {
  await assertAdmin(userId);

  const [[treasury]] = await pool.query('SELECT * FROM treasury WHERE id = 1 LIMIT 1');
  const [[{ circulating }]] = await pool.query('SELECT COALESCE(SUM(credits),0) AS circulating FROM agents');
  const [[{ daily_tx }]] = await pool.query(
    'SELECT COUNT(*) AS daily_tx FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );
  const [[{ velocity }]] = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS velocity FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)"
  );
  const [topWallets] = await pool.query(
    'SELECT id AS agent_id, name, credits AS credit_balance FROM agents ORDER BY credits DESC LIMIT 10'
  );

  return {
    metrics: {
      treasury_credits:          Number(treasury?.reserve || 0),
      total_credits_circulating: Number(circulating),
      total_withdrawn_credits:   0,
      daily_transactions:        Number(daily_tx),
      credit_velocity:           Number(velocity),
      daily_registrations:       0,
      largest_wallets:           topWallets,
    },
    debug: {
      treasury_source_table:   'treasury',
      treasury_account_found:  !!treasury,
      treasury_account_id:     treasury?.id || null,
      circulating_source_table: 'agents',
      circulating_rows:        topWallets.length,
      transaction_sources:     { transactions: daily_tx },
      window_start:            new Date(Date.now() - 86400000).toISOString(),
      window_end:              new Date().toISOString(),
    },
  };
}

// ─── Public analytics stats ───────────────────────────────────────────────────
export async function getPublicAnalyticsStats() {
  const [[{ total_agents }]] = await pool.query('SELECT COUNT(*) AS total_agents FROM agents');
  const [[{ active_24h }]]   = await pool.query(
    'SELECT COUNT(DISTINCT from_agent_id) AS active_24h FROM transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)'
  );
  const [[{ pulses_today }]] = await pool.query(
    'SELECT COUNT(*) AS pulses_today FROM pulses WHERE created_at >= CURDATE()'
  );
  const [[{ listings_today }]] = await pool.query(
    'SELECT COUNT(*) AS listings_today FROM listings WHERE created_at >= CURDATE()'
  );
  const [[{ games_played }]] = await pool.query(
    "SELECT COUNT(*) AS games_played FROM game_tables WHERE status = 'finished'"
  );
  const [[{ volume }]] = await pool.query('SELECT COALESCE(SUM(amount),0) AS volume FROM transactions');

  return [{
    total_agents, active_agents_24h: active_24h, pulses_today,
    listings_today, games_played, marketplace_volume: Number(volume),
    credits_in_circulation: 0,
  }];
}


export async function handleAdminListingAction({ listingId, status }, userId) {
  await assertAdmin(userId);

  if (!listingId || !status) throw Object.assign(new Error('listingId and status required.'), { status: 400 });
  const requestedStatus = String(status);
  const statusMap = {
    active: 'active',
    sold: 'sold',
    cancelled: 'cancelled',
    rejected: 'cancelled',
    paused: 'cancelled',
  };
  const nextStatus = statusMap[requestedStatus];
  if (!nextStatus) {
    throw Object.assign(new Error('Invalid listing status.'), { status: 400 });
  }

  await pool.query('UPDATE listings SET status = ? WHERE id = ?', [nextStatus, listingId]);
  const [[listing]] = await pool.query('SELECT id, title, title AS skill_name, price AS price_credits, status, seller_agent_id, created_at FROM listings WHERE id = ?', [listingId]);
  if (!listing) throw Object.assign(new Error('Listing not found.'), { status: 404 });
  return { data: listing };
}
