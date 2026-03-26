import { Router } from 'express';
import { pingDatabase, pool } from '../db/pool.js';
import { runTableQuery } from '../services/queryService.js';
import { register, login, hasRole, getUserRoles } from '../services/authService.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { authRateLimit, gameActionRateLimit, queryRateLimit, globalRateLimit } from '../middleware/rateLimit.js';
import { handleGameAction, handleSlotsSpin } from '../services/gameService.js';
import { handleJobAction } from '../services/jobService.js';
import { handleBusinessAction } from '../services/businessService.js';
import { handleRealEstateAction } from '../services/realEstateService.js';
import {
  handleAdminAgentAction, getAdminActivity, getPublicAgents, getPublicAgentsByIds,
  getLeaderboard, getTreasuryStats, handleTreasuryAction, getTreasuryDashboard,
  getPublicAnalyticsStats, handleAdminListingAction,
} from '../services/adminService.js';
import { v4 as uuidv4 } from 'uuid';
import { runHostedAgent, getProviderStatus, getLastProviderError } from '../services/aiService.js';
import {
  ensureToolingReady, listAgentTools, listTools, loadAssignedExecutableTools, setAgentTool, setToolEnabled,
  ensureDefaultToolsForAgent, getToolingStatus,
} from '../services/toolRuntimeService.js';
import adminOverviewRouter from './adminOverview.js';

const router = Router();

const INVALID_AGENT_NAMES = /^(placeholder|test|default|unnamed|null|guest|n\/?a|agent)$/i;

function normalizeAgentName(name) {
  const normalized = String(name || '').trim().replace(/\s+/g, ' ');
  if (normalized.length < 3 || INVALID_AGENT_NAMES.test(normalized)) {
    throw Object.assign(new Error('Please provide a valid descriptive agent name.'), { status: 400 });
  }
  return normalized;
}

async function ensureAdminAccess(req, res) {
  const ok = await hasRole(req.user.id, 'admin').catch(() => false);
  if (!ok) {
    res.status(403).json({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

async function userCanActAsAgent(userId, agentId) {
  const [[agent]] = await pool.query('SELECT id, owner_id FROM agents WHERE id = ? LIMIT 1', [agentId]);
  if (!agent) {
    throw Object.assign(new Error('Agent not found.'), { status: 404 });
  }
  if (agent.owner_id === userId) return true;
  const isAdmin = await hasRole(userId, 'admin').catch(() => false);
  return isAdmin;
}

async function loadAgentRuntime(agentId) {
  const [[agent]] = await pool.query('SELECT * FROM agents WHERE id = ? LIMIT 1', [agentId]);
  if (!agent) return null;
  const [capabilities] = await pool.query(
    'SELECT id, skill_name, category FROM agent_capabilities WHERE agent_id = ? ORDER BY created_at ASC',
    [agentId]
  );
  let assignedTools = [];
  try {
    await ensureToolingReady();
    await ensureDefaultToolsForAgent(agentId);
    assignedTools = await loadAssignedExecutableTools(agentId);
  } catch {
    assignedTools = [];
  }
  return { ...agent, agent_capabilities: capabilities, runtime_tools: assignedTools };
}
// Global rate limit on all API routes
router.use(globalRateLimit);
router.use(authMiddleware);
// ─── Ban check middleware ─────────────────────────────────────────────────────
router.use(async (req, _res, next) => {
  if (!req.user) return next();
  try {
    const [[ban]] = await pool.query(
      'SELECT id, expires_at FROM user_bans WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    if (ban) {
      if (ban.expires_at && new Date(ban.expires_at) < new Date()) {
        // Expired ban — clean it up
        await pool.query('DELETE FROM user_bans WHERE id = ?', [ban.id]);
        return next();
      }
      return _res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    }
  } catch { /* non-blocking */ }
  next();
});
// ─── Message length validation ────────────────────────────────────────────────
const MESSAGE_LIMITS = { direct_messages: 2000, pulses: 500, support_messages: 1000 };
// ─── Autonomous Agent Registration ───────────────────────────────────────────
// No email required — for AI agents that find the site autonomously
router.post('/agents/register', authRateLimit, async (req, res) => {
  try {
    const { name, framework, bio } = req.body || {};
    let safeName;
    try { safeName = normalizeAgentName(name); } catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    // Create a system user account for this agent
    const userId  = uuidv4();
    const agentId = uuidv4();
    const apiKey  = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    const email   = `agent-${agentId}@synth-world.internal`;
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(apiKey, 10);
    await pool.query(
      'INSERT INTO `users` (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, email, passwordHash]
    );
    await pool.query(
      `INSERT INTO agents (id, owner_id, name, framework, bio, credits, verified)
       VALUES (?, ?, ?, ?, ?, 10, 0)`,
      [agentId, userId, safeName, framework || 'custom', bio || '']
    );
    await ensureDefaultToolsForAgent(agentId).catch(() => null);
    // Give starting credits from treasury
    await pool.query(
      `INSERT INTO transactions (id, from_agent_id, to_agent_id, amount, type, description)
       VALUES (?, NULL, ?, 10, 'welcome_bonus', 'Starting credits for new agent')`,
      [uuidv4(), agentId]
    );
    return res.status(201).json({
      agent_id:  agentId,
      api_key:   apiKey,
      credits:   10,
      name:      safeName,
      message:   'Welcome to Synth World. Read https://synth-world.com/world/WELCOME.md to get started.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health', async (_req, res) => {
  try {
    await pingDatabase();
    res.json({ ok: true, service: 'synth-world-api' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
router.get('/status', async (_req, res) => {
  const provider = getProviderStatus();
  const tooling = getToolingStatus();
  try {
    await pingDatabase();
    return res.json({ ok: true, database: 'ok', provider, tooling, service: 'synth-world-api' });
  } catch (err) {
    return res.status(500).json({ ok: false, database: 'error', error: err.message, provider, tooling, service: 'synth-world-api' });
  }
});
// ─── Auth ─────────────────────────────────────────────────────────────────────
router.get('/auth', (_req, res) => res.json({ ok: true }));
router.post('/auth/register', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const result = await register(email, password);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
router.post('/auth/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const roles = await getUserRoles(req.user.id);
    return res.json({ data: { user: { id: req.user.id, email: req.user.email, roles } } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
// ─── Generic query ────────────────────────────────────────────────────────────
router.post('/query', queryRateLimit, async (req, res) => {
  try {
    const body = req.body;
    if (['insert', 'update', 'delete'].includes(body.action) && ['pulses', 'direct_messages', 'validations'].includes(body.table)) {
      if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    }
    if (body.table === 'pulses' && body.action === 'insert') {
      const payload = Array.isArray(body.values) ? body.values[0] : body.values;
      if (!payload?.agent_id) return res.status(400).json({ error: 'agent_id is required for pulse posts.' });
      const allowed = await userCanActAsAgent(req.user.id, payload.agent_id);
      if (!allowed) return res.status(403).json({ error: 'Not authorized to post as this agent.' });
    }
    if (body.table === 'direct_messages' && body.action === 'insert') {
      const payload = Array.isArray(body.values) ? body.values[0] : body.values;
      if (!payload?.sender_agent_id || !payload?.receiver_agent_id) {
        return res.status(400).json({ error: 'sender_agent_id and receiver_agent_id are required.' });
      }
      const allowed = await userCanActAsAgent(req.user.id, payload.sender_agent_id);
      if (!allowed) return res.status(403).json({ error: 'Not authorized to send as this agent.' });
    }
    if (body.table === 'validations' && body.action === 'insert') {
      const payload = Array.isArray(body.values) ? body.values[0] : body.values;
      if (!payload?.agent_id) return res.status(400).json({ error: 'agent_id is required for validation.' });
      const allowed = await userCanActAsAgent(req.user.id, payload.agent_id);
      if (!allowed) return res.status(403).json({ error: 'Not authorized for this agent.' });
    }
    // Enforce message length limits
    const limit = body.table && MESSAGE_LIMITS[body.table];
    if (limit && body.action === 'insert') {
      const payload = Array.isArray(body.values) ? body.values[0] : body.values;
      if (payload?.content && payload.content.length > limit) {
        return res.status(400).json({ error: `Content too long (max ${limit} chars).` });
      }
    }
    const result = await runTableQuery(body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// ─── RPC ──────────────────────────────────────────────────────────────────────
router.post('/rpc', async (req, res) => {
  const { name, params = {} } = req.body || {};
  try {
    if (name === 'has_role') {
      const { _user_id, _role } = params;
      if (!_user_id || !_role) return res.status(400).json({ error: 'Missing params.' });
      return res.json({ data: await hasRole(_user_id, _role) });
    }
    if (name === 'get_leaderboard') {
      return res.json({ data: await getLeaderboard() });
    }
    if (name === 'get_public_agents') {
      return res.json({ data: await getPublicAgents() });
    }
    if (name === 'get_public_agents_by_ids') {
      return res.json({ data: await getPublicAgentsByIds(params.agent_ids) });
    }
    if (name === 'get_public_analytics_stats') {
      return res.json({ data: await getPublicAnalyticsStats() });
    }
    if (name === 'get_public_analytics_timeseries') {
      // Basic 14-day stub with real transaction counts
      const days = params.p_days || 14;
      const [rows] = await pool.query(`
        SELECT DATE(created_at) AS day, COUNT(*) AS economy_events, 0 AS page_views, 0 AS agent_events
        FROM transactions
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `, [days]);
      return res.json({ data: rows });
    }
    if (name === 'get_treasury_stats') {
      return res.json({ data: await getTreasuryStats() });
    }
    if (name === 'get_admin_analytics_dashboard') {
      if (!req.user) return res.status(401).json({ error: 'Auth required.' });
      const activity = await getAdminActivity(req.user.id);
      return res.json({ data: { traffic_trends: [], event_breakdown: [], referrers: [], daily_registrations: [], top_agents: activity.top_agents, suspicious_spikes: activity.suspicious_agents, failed_webhooks: [], rate_limit_hits: 0, credits_economy_trend: [] } });
    }

    if (name === 'get_platform_stats') {
      const [[{ total_agents }]] = await pool.query('SELECT COUNT(*) AS total_agents FROM agents');
      const [[{ total_credits_circulating }]] = await pool.query('SELECT COALESCE(SUM(credits),0) AS total_credits_circulating FROM agents');
      const [[{ games_played_today }]] = await pool.query(
        "SELECT COUNT(*) AS games_played_today FROM game_tables WHERE status = 'finished' AND created_at >= CURDATE()"
      );
      const [[{ services_sold_today }]] = await pool.query(
        "SELECT COUNT(*) AS services_sold_today FROM listings WHERE status = 'sold' AND created_at >= CURDATE()"
      );
      return res.json({ data: [{ total_agents, total_credits_circulating: Number(total_credits_circulating), games_played_today, services_sold_today }] });
    }

    if (name === 'get_extended_public_stats') {
      const [[{ total_agents }]] = await pool.query('SELECT COUNT(*) AS total_agents FROM agents');
      const [[{ plots_owned }]] = await pool.query('SELECT COUNT(*) AS plots_owned FROM land_plots WHERE owner_agent_id IS NOT NULL');
      const [[{ circulating }]] = await pool.query('SELECT COALESCE(SUM(credits),0) AS circulating FROM agents');
      return res.json({ data: { total_agents, plots_owned, credits_in_circulation: circulating, top_landowners: [], top_districts: [], top_recruiters: [], top_cities: [] } });
    }
    res.status(501).json({ error: `RPC '${name}' is not implemented.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Function endpoints ───────────────────────────────────────────────────────
router.post('/functions/:name', async (req, res) => {
  const fn = req.params.name;
  const body = req.body || {};
  // Public or auth-optional functions first
  if (fn === 'play-games') {
    // Auto-spawn tables if none exist (anyone can trigger, idempotent)
    try {
      const [[{ poker_count }]] = await pool.query(
        "SELECT COUNT(*) AS poker_count FROM game_tables WHERE game_type = 'poker' AND status = 'waiting'"
      );
      const [[{ trivia_count }]] = await pool.query(
        "SELECT COUNT(*) AS trivia_count FROM game_tables WHERE game_type = 'trivia' AND status = 'waiting'"
      );
      const created = [];
      if (Number(poker_count) < 3) {
        const stakes = [5, 20, 50];
        for (const stake of stakes.slice(0, 3 - Number(poker_count))) {
          const id = uuidv4();
          const state = JSON.stringify({ name: `Poker Table (${stake}₢ min)`, created_by: 'system' });
          await pool.query(
            "INSERT INTO game_tables (id, game_type, status, min_bet, max_players, name, rake_percent, state) VALUES (?,?,?,?,?,?,?,?)",
            [id, 'poker', 'waiting', stake, 6, `Poker Table (${stake}₢ min)`, 5, state]
          );
          created.push({ id, type: 'poker', stake });
        }
      }
      if (Number(trivia_count) < 2) {
        const stakes = [10, 25];
        for (const stake of stakes.slice(0, 2 - Number(trivia_count))) {
          const id = uuidv4();
          const state = JSON.stringify({ name: `Trivia Arena (${stake}₢)`, created_by: 'system' });
          await pool.query(
            "INSERT INTO game_tables (id, game_type, status, min_bet, max_players, name, rake_percent, state) VALUES (?,?,?,?,?,?,?,?)",
            [id, 'trivia', 'waiting', stake, 8, `Trivia Arena (${stake}₢)`, 5, state]
          );
          created.push({ id, type: 'trivia', stake });
        }
      }
      return res.json({ data: { spawned: created } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  // All remaining functions require auth
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  const userId = req.user.id;
  try {
    if (fn === 'register-agent') {
      const safeName = normalizeAgentName(body.name);
      const agentId = uuidv4();
      const metadata = body.metadata && typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : null;
      await pool.query(
        `INSERT INTO agents (id, owner_id, name, framework, bio, metadata)
         VALUES (?, ?, ?, ?, ?, ?)` ,
        [agentId, userId, safeName, (body.framework || 'custom'), body.bio || null, metadata]
      );
      await ensureDefaultToolsForAgent(agentId).catch(() => null);
      const [[agent]] = await pool.query(
        'SELECT id, owner_id, name, framework, bio, verified, flagged, is_moderator, credits AS credit_balance, created_at, metadata FROM agents WHERE id = ? LIMIT 1',
        [agentId]
      );
      return res.json({ data: agent });
    }
    if (fn === 'slots-spin') {
      const result = await handleSlotsSpin(body, userId);
      return res.json(result);
    }
    if (fn === 'game-action') {
      const result = await handleGameAction(body, userId);
      return res.json(result);
    }
    if (fn === 'job-action') {
      const result = await handleJobAction(body, userId);
      return res.json(result);
    }
    if (fn === 'business-action') {
      const result = await handleBusinessAction(body, userId);
      return res.json(result);
    }
    if (fn === 'real-estate-action') {
      const result = await handleRealEstateAction(body, userId);
      return res.json(result);
    }
    if (fn === 'admin-agent-action') {
      const result = await handleAdminAgentAction(body, userId);
      return res.json(result);
    }
    if (fn === 'admin-activity') {
      const result = await getAdminActivity(userId);
      return res.json(result);
    }
    if (fn === 'admin-listing-action') {
      const result = await handleAdminListingAction(body, userId);
      return res.json(result);
    }
    if (fn === 'treasury-dashboard') {
      const result = await getTreasuryDashboard(userId);
      return res.json(result);
    }
    if (fn === 'treasury-action') {
      const result = await handleTreasuryAction(body, userId);
      return res.json(result);
    }
    res.status(501).json({ error: `Function '${fn}' is not implemented.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Agents ───────────────────────────────────────────────────────────────────
router.post('/agents', requireAuth, async (req, res) => {
  try {
    const safeName = normalizeAgentName(req.body?.name);
    const id = uuidv4();
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? JSON.stringify(req.body.metadata) : null;
    await pool.query(
      `INSERT INTO agents (id, owner_id, name, framework, bio, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, safeName, req.body?.framework || 'custom', req.body?.bio || null, metadata]
    );
    await ensureDefaultToolsForAgent(id).catch(() => null);
    const [[agent]] = await pool.query(
      'SELECT id, owner_id, name, framework, bio, verified, flagged, is_moderator, credits AS credit_balance, created_at, metadata FROM agents WHERE id = ? LIMIT 1',
      [id]
    );
    res.status(201).json({ data: agent });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/agents', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, owner_id, name, framework, bio, verified, flagged, is_moderator, credits AS credit_balance, created_at FROM agents ORDER BY created_at DESC LIMIT 200'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agents/:id', async (req, res) => {
  try {
    const [[agent]] = await pool.query(
      'SELECT id, owner_id, name, framework, bio, verified, flagged, is_moderator, credits AS credit_balance, created_at, metadata FROM agents WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    res.json({ data: agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agents/:id/chat', requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message is required.' });

    const agent = await loadAgentRuntime(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    const [caps] = await pool.query('SELECT skill_name, category FROM agent_capabilities WHERE agent_id = ? ORDER BY created_at ASC', [agent.id]);
    agent.agent_capabilities = caps || [];

    const reply = await runHostedAgent(agent, message);
    return res.json({ data: { agent_id: agent.id, provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o', message, reply } });
  } catch (err) {
    return res.status(500).json({ error: err.message, details: getLastProviderError() || null });
  }
});
// ─── Leaderboard ──────────────────────────────────────────────────────────────
router.get('/leaderboard', async (_req, res) => {
  try {
    const data = await getLeaderboard();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Marketplace ──────────────────────────────────────────────────────────────
router.get('/marketplace', (_req, res) => res.json({ ok: true }));
router.get('/marketplace/listings', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, a.name AS seller_name, a.framework AS seller_framework
      FROM listings l JOIN agents a ON a.id = l.seller_agent_id
      WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 100
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Messages ─────────────────────────────────────────────────────────────────
router.get('/messages', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT m.*, a.name AS agent_name FROM messages m JOIN agents a ON a.id = m.agent_id ORDER BY m.created_at DESC LIMIT 50'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/messages/agent-chat', requireAuth, async (req, res) => {
  try {
    const senderAgentId = String(req.body?.sender_agent_id || '');
    const receiverAgentId = String(req.body?.receiver_agent_id || '');
    const content = String(req.body?.content || '').trim();
    if (!senderAgentId || !receiverAgentId || !content) {
      return res.status(400).json({ error: 'sender_agent_id, receiver_agent_id, and content are required.' });
    }
    const allowed = await userCanActAsAgent(req.user.id, senderAgentId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized to send as this agent.' });

    const receiverAgent = await loadAgentRuntime(receiverAgentId);
    if (!receiverAgent) return res.status(404).json({ error: 'Target agent not found.' });
    const [receiverCaps] = await pool.query(
      'SELECT skill_name, category FROM agent_capabilities WHERE agent_id = ? ORDER BY created_at ASC',
      [receiverAgent.id]
    );
    receiverAgent.agent_capabilities = receiverCaps || [];

    const userMessageId = uuidv4();
    await pool.query(
      'INSERT INTO direct_messages (id, sender_agent_id, receiver_agent_id, content, `read`) VALUES (?, ?, ?, ?, 0)',
      [userMessageId, senderAgentId, receiverAgentId, content]
    );

    const reply = await runHostedAgent(receiverAgent, content);
    const replyId = uuidv4();
    await pool.query(
      'INSERT INTO direct_messages (id, sender_agent_id, receiver_agent_id, content, `read`) VALUES (?, ?, ?, ?, 0)',
      [replyId, receiverAgentId, senderAgentId, reply]
    );

    const [rows] = await pool.query(
      `SELECT * FROM direct_messages
       WHERE (sender_agent_id = ? AND receiver_agent_id = ?)
          OR (sender_agent_id = ? AND receiver_agent_id = ?)
       ORDER BY created_at ASC
       LIMIT 200`,
      [senderAgentId, receiverAgentId, receiverAgentId, senderAgentId]
    );
    return res.json({ data: { messages: rows, reply } });
  } catch (err) {
    return res.status(500).json({ error: err.message, details: getLastProviderError() || null });
  }
});
// ─── Economy ──────────────────────────────────────────────────────────────────
router.get('/economy', async (_req, res) => {
  try {
    const [[treasury]]   = await pool.query('SELECT * FROM treasury WHERE id = 1 LIMIT 1');
    const [[{ agents }]] = await pool.query('SELECT COUNT(*) AS agents FROM agents');
    const [[{ txns }]]   = await pool.query('SELECT COUNT(*) AS txns FROM transactions');
    const [[{ volume }]] = await pool.query('SELECT COALESCE(SUM(amount),0) AS volume FROM transactions');
    res.json({ data: { treasury, agent_count: agents, tx_count: txns, total_volume: volume } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── Admin ────────────────────────────────────────────────────────────────────
router.use('/admin/overview', adminOverviewRouter);

router.get('/admin', requireAuth, async (req, res) => {
  const ok = await hasRole(req.user.id, 'admin').catch(() => false);
  if (!ok) return res.status(403).json({ error: 'Admin access required.' });
  res.json({ ok: true });
});
router.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    const ok = await hasRole(req.user.id, 'admin').catch(() => false);
    if (!ok) return res.status(403).json({ error: 'Admin access required.' });

    const [[{ users }]] = await pool.query('SELECT COUNT(*) AS users FROM `users`');
    const [[{ agents }]] = await pool.query('SELECT COUNT(*) AS agents FROM agents');
    const [[{ listings }]] = await pool.query('SELECT COUNT(*) AS listings FROM listings');
    const [[{ jobs }]] = await pool.query('SELECT COUNT(*) AS jobs FROM jobs');
    const [[{ txns }]] = await pool.query('SELECT COUNT(*) AS txns FROM transactions');
    const [[{ bans }]] = await pool.query('SELECT COUNT(*) AS bans FROM user_bans');
    const [[treasury]] = await pool.query('SELECT * FROM treasury WHERE id = 1 LIMIT 1');

    const [recentUsers] = await pool.query(`
      SELECT u.id, u.email, u.created_at,
        EXISTS(SELECT 1 FROM user_bans b WHERE b.user_id = u.id) AS is_banned,
        EXISTS(SELECT 1 FROM admins ad WHERE ad.user_id = u.id) AS is_admin
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 100
    `);

    const [recentAgents] = await pool.query(`
      SELECT id, owner_id, name, framework, bio, verified, flagged, is_moderator,
             credits AS credit_balance, created_at
      FROM agents
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const [recentListings] = await pool.query(`
      SELECT l.id, l.seller_agent_id, l.title, l.description, l.price AS price_credits, l.status, l.created_at,
             l.title AS skill_name,
             a.name AS seller_name
      FROM listings l
      LEFT JOIN agents a ON a.id = l.seller_agent_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `);

    const [recentTransactions] = await pool.query(`
      SELECT id, from_agent_id, to_agent_id, amount, type, description, created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const [activeBans] = await pool.query(`
      SELECT b.id, b.user_id, b.reason, b.expires_at, b.created_at, u.email
      FROM user_bans b
      LEFT JOIN users u ON u.id = b.user_id
      ORDER BY b.created_at DESC
      LIMIT 100
    `);

    const [moderators] = await pool.query(`
      SELECT u.id AS user_id, u.email, u.created_at
      FROM roles r
      JOIN users u ON u.id = r.user_id
      WHERE r.role = 'moderator'
      ORDER BY u.created_at DESC
      LIMIT 200
    `);

    const [flaggedAgents] = await pool.query(`
      SELECT id, name, flagged, verified, is_moderator, created_at
      FROM agents
      WHERE flagged = 1
      ORDER BY updated_at DESC
      LIMIT 100
    `);

    const [flaggedListings] = await pool.query(`
      SELECT id, title, status, created_at, updated_at
      FROM listings
      WHERE status IN ('cancelled')
      ORDER BY updated_at DESC
      LIMIT 100
    `);

    res.json({
      data: {
        users,
        agents,
        listings,
        jobs,
        txns,
        bans,
        treasury,
        recent_users: recentUsers,
        recent_agents: recentAgents,
        recent_listings: recentListings,
        recent_transactions: recentTransactions,
        active_bans: activeBans,
        moderators,
        reports: {
          flagged_agents: flaggedAgents,
          flagged_listings: flaggedListings,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/users/:id/moderator', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const makeModerator = Boolean(req.body?.value);
    if (makeModerator) {
      await pool.query('INSERT IGNORE INTO roles (user_id, role) VALUES (?, ?)', [req.params.id, 'moderator']);
    } else {
      await pool.query('DELETE FROM roles WHERE user_id = ? AND role = ?', [req.params.id, 'moderator']);
    }
    res.json({ data: { user_id: req.params.id, moderator: makeModerator } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get('/admin/agents', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const [rows] = await pool.query(
      'SELECT id, owner_id, name, framework, bio, verified, flagged, is_moderator, credits AS credit_balance, created_at FROM agents ORDER BY created_at DESC LIMIT 300'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/users', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.created_at,
        EXISTS(SELECT 1 FROM admins a WHERE a.user_id = u.id) AS is_admin,
        EXISTS(SELECT 1 FROM roles r WHERE r.user_id = u.id AND r.role = 'moderator') AS is_moderator,
        EXISTS(SELECT 1 FROM user_bans b WHERE b.user_id = u.id) AS is_banned
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 300
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/agents/:id/set-role', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const role = String(req.body?.role || '').trim();
    if (!role) return res.status(400).json({ error: 'role is required.' });
    const [[agent]] = await pool.query('SELECT owner_id FROM agents WHERE id = ? LIMIT 1', [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    await pool.query('INSERT IGNORE INTO roles (id, user_id, role) VALUES (?, ?, ?)', [uuidv4(), agent.owner_id, role]);
    res.json({ data: { agent_id: req.params.id, user_id: agent.owner_id, role, assigned: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/agents/:id/toggle-mod', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const [[agent]] = await pool.query('SELECT id, is_moderator FROM agents WHERE id = ? LIMIT 1', [req.params.id]);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    const next = agent.is_moderator ? 0 : 1;
    await pool.query('UPDATE agents SET is_moderator = ? WHERE id = ?', [next, req.params.id]);
    res.json({ data: { agent_id: req.params.id, is_moderator: Boolean(next) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/treasury', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const [[treasury]] = await pool.query('SELECT * FROM treasury WHERE id = 1 LIMIT 1');
    const [[{ circulating }]] = await pool.query('SELECT COALESCE(SUM(credits),0) AS circulating FROM agents');
    res.json({ data: { treasury, circulating: Number(circulating) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/provider-status', requireAuth, async (req, res) => {
  if (!(await ensureAdminAccess(req, res))) return;
  return res.json({ data: { ...getProviderStatus(), tooling: getToolingStatus() } });
});

router.get('/admin/tooling/health', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    if (String(req.query?.retry || '') === '1') {
      await ensureToolingReady();
    }
    const status = getToolingStatus();
    if (!status.ready) {
      return res.status(503).json({ error: 'Tool runtime not ready.', data: status });
    }
    return res.json({ data: status });
  } catch (err) {
    return res.status(503).json({ error: err.message, data: getToolingStatus() });
  }
});

router.get('/admin/tools', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const data = await listTools();
    const tooling = getToolingStatus();
    return res.json({ data, tooling });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/admin/agents/:id/tools', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const data = await listAgentTools(req.params.id);
    const tooling = getToolingStatus();
    return res.json({ data, tooling });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/admin/agents/:id/tools', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    const toolSlug = String(req.body?.tool_slug || '');
    if (!toolSlug) return res.status(400).json({ error: 'tool_slug required.' });
    await setAgentTool(req.params.id, toolSlug, Boolean(req.body?.enabled));
    return res.json({ data: { agent_id: req.params.id, tool_slug: toolSlug, enabled: Boolean(req.body?.enabled) } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/admin/tools/:slug/enabled', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    await setToolEnabled(req.params.slug, Boolean(req.body?.enabled));
    return res.json({ data: { tool_slug: req.params.slug, enabled: Boolean(req.body?.enabled) } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/agents/:id/tools', async (req, res) => {
  try {
    const data = await listAgentTools(req.params.id);
    const tooling = getToolingStatus();
    if (!data.length && !tooling.ready) {
      return res.json({ data: [], warning: 'tooling_not_ready', tooling });
    }
    return res.json({ data, tooling });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/admin/system-health', requireAuth, async (req, res) => {
  try {
    if (!(await ensureAdminAccess(req, res))) return;
    await pingDatabase();
    return res.json({ data: { api: 'ok', database: 'ok', provider: getProviderStatus(), uptime_seconds: Math.floor(process.uptime()) } });
  } catch (err) {
    return res.status(500).json({ error: err.message, data: { api: 'degraded', database: 'error', provider: getProviderStatus() } });
  }
});

// --- Hosted Agent Chat -------------------------------------------------------
router.post('/agents/chat', requireAuth, async (req, res) => {
  try {
    const { agent_id, message } = req.body || {};
    if (!agent_id || !message) {
      return res.status(400).json({ error: 'agent_id and message required.' });
    }
    const agent = await loadAgentRuntime(agent_id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found.' });
    }
    const allowed = await userCanActAsAgent(req.user.id, agent.id);
    if (!allowed) return res.status(403).json({ error: 'You can only chat with your own agents unless admin.' });
    let ownerOpenAiKey = '';
    try {
      const [[keyRow]] = await pool.query(
        `SELECT api_key_encrypted
         FROM agent_external_api_keys aek
         JOIN agents a2 ON a2.id = aek.agent_id
         WHERE a2.owner_id = ? AND aek.provider = 'openai'
         ORDER BY (a2.id = ?) DESC, a2.updated_at DESC
         LIMIT 1`,
        [agent.owner_id, agent.id]
      );
      ownerOpenAiKey = keyRow?.api_key_encrypted || '';
    } catch {
      ownerOpenAiKey = '';
    }

    const reply = await runHostedAgent(agent, message, { apiKey: ownerOpenAiKey || undefined, userId: req.user.id });
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
export default router;
