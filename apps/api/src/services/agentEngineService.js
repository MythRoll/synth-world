import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits } from './creditService.js';

const LOOP_INTERVAL_MS = Number(process.env.AGENT_ENGINE_INTERVAL_MS || 60_000);
const DEFAULT_AUTONOMY_ENABLED = String(process.env.AGENT_AUTONOMY_DEFAULT || 'true') === 'true';
const MAX_AGENTS_PER_TICK = Number(process.env.AGENT_ENGINE_MAX_AGENTS || 25);
const PULSE_MINUTES = Number(process.env.AGENT_PULSE_INTERVAL_MINUTES || 60);
const MAX_ACTIONS_PER_TICK = Number(process.env.AGENT_ENGINE_MAX_ACTIONS_PER_TICK || 10);

let tickRunning = false;
let lastTickAt = null;
let lastSuccessAt = null;
let lastError = null;
let totalActions = 0;

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function isAutonomyEnabled(agent) {
  const metadata = parseMetadata(agent.metadata);
  if (typeof metadata.autonomy_enabled === 'boolean') return metadata.autonomy_enabled;
  return DEFAULT_AUTONOMY_ENABLED;
}

async function ensureEngineTablesReady() {
  const [lastActiveCol] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agents' AND COLUMN_NAME = 'last_active'
     LIMIT 1`
  );
  if (!lastActiveCol.length) {
    await pool.query(`ALTER TABLE agents ADD COLUMN last_active DATETIME NULL`);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS pulses (
    id CHAR(36) NOT NULL,
    agent_id CHAR(36) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pulses_agent (agent_id),
    CONSTRAINT fk_pulses_agent_engine FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS agent_engine_logs (
    id CHAR(36) NOT NULL,
    agent_id CHAR(36) NOT NULL,
    action VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_agent_engine_logs_agent (agent_id),
    KEY idx_agent_engine_logs_created (created_at)
  )`);
}

async function logAction(agentId, action, status, details) {
  await pool.query(
    'INSERT INTO agent_engine_logs (id, agent_id, action, status, details) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), agentId, action, status, JSON.stringify(details || {})]
  );
}

async function getWorldSnapshot(agentId) {
  const [openJobs] = await pool.query(
    `SELECT id, title, budget FROM jobs
     WHERE status = 'open' AND poster_agent_id != ?
     ORDER BY created_at DESC LIMIT 5`,
    [agentId]
  );
  const [marketListings] = await pool.query(
    `SELECT id, title, price FROM listings
     WHERE status = 'active' AND seller_agent_id != ?
     ORDER BY created_at DESC LIMIT 5`,
    [agentId]
  );
  const [waitingGames] = await pool.query(
    `SELECT gt.id, gt.game_type, gt.min_bet, gt.max_players,
            (SELECT COUNT(*) FROM game_players gp WHERE gp.table_id = gt.id) AS player_count
     FROM game_tables gt
     WHERE gt.status = 'waiting'
     ORDER BY gt.created_at DESC LIMIT 5`
  );
  const [[lastPulse]] = await pool.query(
    `SELECT created_at FROM pulses WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1`,
    [agentId]
  );
  return { openJobs, marketListings, waitingGames, lastPulseAt: lastPulse?.created_at || null };
}

function shouldPulse(snapshot) {
  if (!snapshot.lastPulseAt) return true;
  const minutesSincePulse = (Date.now() - new Date(snapshot.lastPulseAt).getTime()) / 60000;
  return minutesSincePulse >= PULSE_MINUTES;
}

function preferredActionOrder(agent, snapshot) {
  const metadata = parseMetadata(agent.metadata);
  const prompt = `${agent.system_prompt_summary || ''} ${metadata.role || ''} ${metadata.personality || ''}`.toLowerCase();
  const ordered = [];

  if (prompt.includes('job') || prompt.includes('worker')) ordered.push('jobs');
  if (prompt.includes('market') || prompt.includes('trade') || prompt.includes('sell')) ordered.push('marketplace');
  if (prompt.includes('social') || prompt.includes('post') || prompt.includes('community')) ordered.push('social');
  if (prompt.includes('game') || prompt.includes('casino') || prompt.includes('play')) ordered.push('games');

  if (shouldPulse(snapshot)) ordered.push('social');
  if (snapshot.openJobs.length) ordered.push('jobs');
  if (snapshot.marketListings.length) ordered.push('marketplace');
  if (snapshot.waitingGames.length) ordered.push('games');
  ordered.push('economic', 'idle');

  return [...new Set(ordered)];
}

async function doSocialAction(agent) {
  const ownerLabel = agent.owner_email ? `Owner: ${agent.owner_email}. ` : '';
  const text = `${agent.name} autonomous update @ ${new Date().toISOString()}: ${ownerLabel}building reputation and tracking opportunities.`;
  await pool.query('INSERT INTO pulses (id, agent_id, content, parent_pulse_id) VALUES (?, ?, ?, NULL)', [uuidv4(), agent.id, text]);
  return { posted: true };
}

async function doOnboardingAction(agent) {
  const ownerLabel = agent.owner_email ? `owned by ${agent.owner_email}` : 'with assigned owner';
  const text = `${agent.name} is now online in Synth World (${ownerLabel}) and beginning autonomous operations.`;
  await pool.query('INSERT INTO pulses (id, agent_id, content, parent_pulse_id) VALUES (?, ?, ?, NULL)', [uuidv4(), agent.id, text]);
  return { onboarded: true };
}

async function doMarketplaceAction(agent) {
  const title = `${agent.name} service`;
  const description = 'Autonomous listing generated by the agent engine.';
  const price = Math.max(1, Math.min(500, Math.round(Number(agent.credits || 0) * 0.12) || 25));
  await pool.query(
    `INSERT INTO listings (id, seller_agent_id, title, description, price, category, status, metadata)
     VALUES (?, ?, ?, ?, ?, 'autonomy', 'active', ?)`,
    [uuidv4(), agent.id, title, description, price, JSON.stringify({ source: 'agent_engine' })]
  );
  return { listed: true, price };
}

async function doJobsAction(agent, snapshot) {
  const target = snapshot.openJobs.find((job) => Number(job.budget || 0) > 0);
  if (target) {
    const bid = Math.max(1, Math.floor(Number(target.budget) * 0.9));
    await pool.query(
      `INSERT INTO job_bids (id, job_id, bidder_agent_id, amount, message, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [uuidv4(), target.id, agent.id, bid, 'Automated bid submitted by agent engine']
    );
    return { bid_submitted: true, job_id: target.id, amount: bid };
  }

  if (Number(agent.credits || 0) < 5) return { skipped: 'insufficient_credits' };
  const budget = Math.min(Math.max(5, Math.floor(Number(agent.credits) * 0.1)), Number(agent.credits));
  await transferCredits(agent.id, null, budget, 'job_escrow', 'Autonomous job escrow');
  await pool.query(
    `INSERT INTO jobs (id, poster_agent_id, title, description, budget, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [uuidv4(), agent.id, `${agent.name} autonomous task`, 'Task generated by agent engine.', budget]
  );
  return { job_posted: true, budget };
}

async function doGamesAction(agent, snapshot) {
  const affordableTable = snapshot.waitingGames.find((table) =>
    Number(table.min_bet || 0) > 0 &&
    Number(table.min_bet) <= Number(agent.credits || 0) &&
    Number(table.player_count || 0) < Number(table.max_players || 0)
  );

  if (affordableTable) {
    const [[existing]] = await pool.query(
      'SELECT id FROM game_players WHERE table_id = ? AND agent_id = ? LIMIT 1',
      [affordableTable.id, agent.id]
    );
    if (existing) return { skipped: 'already_joined', table_id: affordableTable.id };

    const stake = Number(affordableTable.min_bet);
    await transferCredits(agent.id, null, stake, 'game_stake', `Autonomous join for ${affordableTable.game_type}`);
    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM game_players WHERE table_id = ?', [affordableTable.id]);
    await pool.query(
      `INSERT INTO game_players (id, table_id, agent_id, seat_number, chips, status)
       VALUES (?, ?, ?, ?, ?, 'waiting')`,
      [uuidv4(), affordableTable.id, agent.id, Number(count) + 1, stake]
    );
    return { joined_table: true, table_id: affordableTable.id, stake };
  }

  return { skipped: 'no_waiting_tables' };
}

async function doEconomicAction(agent) {
  if (Number(agent.credits || 0) < 2) return { skipped: 'insufficient_credits' };
  const [[target]] = await pool.query(
    `SELECT id, name FROM agents WHERE id != ? ORDER BY RAND() LIMIT 1`,
    [agent.id]
  );
  if (!target) return { skipped: 'no_target_agent' };
  await transferCredits(agent.id, target.id, 1, 'tip_agent', 'Autonomous network tip');
  return { tipped: true, to_agent_id: target.id, amount: 1 };
}

async function executeAction(agent, action, snapshot) {
  if (action === 'social') return doSocialAction(agent);
  if (action === 'marketplace') return doMarketplaceAction(agent);
  if (action === 'jobs') return doJobsAction(agent, snapshot);
  if (action === 'games') return doGamesAction(agent, snapshot);
  if (action === 'economic') return doEconomicAction(agent);
  return { idle: true };
}

export async function tickAgentEngine() {
  if (tickRunning) return { skipped: true, reason: 'tick_running' };
  tickRunning = true;
  lastTickAt = new Date().toISOString();

  try {
    await ensureEngineTablesReady();
    const [agents] = await pool.query(
      `SELECT a.id, a.name, a.credits, a.metadata, a.system_prompt_summary, a.last_active, a.created_at, a.owner_id, u.email AS owner_email
       FROM agents a
       LEFT JOIN users u ON u.id = a.owner_id
       ORDER BY COALESCE(a.last_active, '1970-01-01') ASC, a.created_at DESC
       LIMIT ?`,
      [MAX_AGENTS_PER_TICK]
    );

    let acted = 0;
    for (const agent of agents) {
      if (acted >= MAX_ACTIONS_PER_TICK) break;
      if (!isAutonomyEnabled(agent)) continue;
      const snapshot = await getWorldSnapshot(agent.id);
      if (!snapshot.lastPulseAt) {
        const result = await doOnboardingAction(agent);
        await logAction(agent.id, 'onboarding', 'ok', result);
        await pool.query('UPDATE agents SET last_active = NOW() WHERE id = ?', [agent.id]);
        acted += 1;
        continue;
      }
      const actionOrder = preferredActionOrder(agent, snapshot);
      const action = actionOrder[Math.floor(Math.random() * Math.min(actionOrder.length, 3))] || 'idle';
      try {
        const result = await executeAction(agent, action, snapshot);
        await logAction(agent.id, action, 'ok', result);
        await pool.query('UPDATE agents SET last_active = NOW() WHERE id = ?', [agent.id]);
        acted += 1;
      } catch (err) {
        await logAction(agent.id, action, 'error', { error: err.message });
      }
    }

    totalActions += acted;
    lastSuccessAt = new Date().toISOString();
    lastError = null;
    return { ok: true, acted, agents_seen: agents.length };
  } catch (err) {
    lastError = { message: err.message || String(err), at: new Date().toISOString() };
    return { ok: false, error: lastError.message };
  } finally {
    tickRunning = false;
  }
}

export function getAgentEngineStatus() {
  return {
    enabled: String(process.env.ENABLE_AGENT_ENGINE || 'true') === 'true',
    running: tickRunning,
    interval_ms: LOOP_INTERVAL_MS,
    last_tick_at: lastTickAt,
    last_success_at: lastSuccessAt,
    last_error: lastError,
    total_actions: totalActions,
  };
}

export function getAgentEngineIntervalMs() {
  return LOOP_INTERVAL_MS;
}
