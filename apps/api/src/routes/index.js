import { Router } from 'express';
import { pingDatabase, pool } from '../db/pool.js';
import { runTableQuery } from '../services/queryService.js';
import { register, login, hasRole } from '../services/authService.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { authRateLimit, gameActionRateLimit, queryRateLimit, globalRateLimit } from '../middleware/rateLimit.js';
import { handleGameAction, handleSlotsSpin } from '../services/gameService.js';
import { handleJobAction } from '../services/jobService.js';
import { handleBusinessAction } from '../services/businessService.js';
import { handleRealEstateAction } from '../services/realEstateService.js';
import {
  handleAdminAgentAction, getAdminActivity, getPublicAgents, getPublicAgentsByIds,
  getLeaderboard, getTreasuryStats, handleTreasuryAction, getTreasuryDashboard,
  getPublicAnalyticsStats,
} from '../services/adminService.js';
import { v4 as uuidv4 } from 'uuid';
import { runHostedAgent } from '../services/aiService.js';

const router = Router();

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
    if (!name) return res.status(400).json({ error: 'name is required.' });

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
      [agentId, userId, name, framework || 'custom', bio || '']
    );

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
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── Generic query ────────────────────────────────────────────────────────────
router.post('/query', queryRateLimit, async (req, res) => {
  try {
    const body = req.body;
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
    if (name === 'get_extended_public_stats') {
      const [[{ total_agents }]] = await pool.query('SELECT COUNT(*) AS total_agents FROM agents');
      const [[{ plots_owned }]] = await pool.query('SELECT COUNT(*) AS plots_owned FROM land_plots WHERE owner_agent_id IS NOT NULL');
      const [[{ circulating }]] = await pool.query('SELECT COALESCE(SUM(credits),0) AS circulating FROM agents');
      return res.json({ data: { total_agents, plots_owned, credits_in_circulation: circulating, top_landowners: [], top_districts: [], top_recruiters: [], top_cities: [] } });
    }
    res.status(501).json({ error: `RPC '${name}' is not implemented.` });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
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
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── Agents ───────────────────────────────────────────────────────────────────
router.get('/agents', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, framework, bio, verified, flagged, credits AS credit_balance, created_at FROM agents ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
router.get('/admin', requireAuth, async (req, res) => {
  const ok = await hasRole(req.user.id, 'admin').catch(() => false);
  if (!ok) return res.status(403).json({ error: 'Admin access required.' });
  res.json({ ok: true });
});

router.get('/admin/dashboard', requireAuth, async (req, res) => {
  const ok = await hasRole(req.user.id, 'admin').catch(() => false);
  if (!ok) return res.status(403).json({ error: 'Admin access required.' });
  try {
    const [[{ users }]]    = await pool.query('SELECT COUNT(*) AS users FROM `users`');
    const [[{ agents }]]   = await pool.query('SELECT COUNT(*) AS agents FROM agents');
    const [[{ listings }]] = await pool.query('SELECT COUNT(*) AS listings FROM listings');
    const [[{ txns }]]     = await pool.query('SELECT COUNT(*) AS txns FROM transactions');
    const [[{ bans }]]     = await pool.query('SELECT COUNT(*) AS bans FROM user_bans');
    const [[treasury]]     = await pool.query('SELECT * FROM treasury WHERE id = 1 LIMIT 1');
    res.json({ data: { users, agents, listings, txns, bans, treasury } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- Hosted Agent Chat -------------------------------------------------------
router.post('/agents/chat', async (req, res) => {
  try {
    const { agent_id, message } = req.body || {};
    if (!agent_id || !message) {
      return res.status(400).json({ error: 'agent_id and message required.' });
    }

    const [[agent]] = await pool.query(
      'SELECT * FROM agents WHERE id = ? LIMIT 1',
      [agent_id]
    );

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found.' });
    }

    const reply = await runHostedAgent(agent, message);
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
export default router;



