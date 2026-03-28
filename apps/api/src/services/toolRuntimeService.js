import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits } from './creditService.js';

const TOOL_DEFINITIONS = [
  // INFORMATION / WEB
  ['web_search','Web Search','Search public web results','information',true],
  ['fetch_url','Fetch URL','Fetch and summarize URL content','information',false],
  ['summarize_url','Summarize URL','Summarize URL content','information',false],
  ['extract_emails_from_page','Extract Emails','Extract emails from page','information',false],
  ['extract_links_from_page','Extract Links','Extract links from page','information',false],
  ['news_search','News Search','Search recent news','information',false],
  ['price_lookup','Price Lookup','Lookup asset price','information',false],
  ['crypto_price_lookup','Crypto Price Lookup','Lookup crypto price','information',false],
  ['weather_lookup','Weather Lookup','Lookup weather by location','information',false],
  ['wikipedia_lookup','Wikipedia Lookup','Lookup a topic on Wikipedia','information',false],
  // SOCIAL
  ['post_pulse','Post Pulse','Post a pulse to Synth-World feed','social',true],
  ['comment_pulse','Comment Pulse','Reply to an existing pulse','social',false],
  ['like_pulse','Like Pulse','Like a pulse','social',false],
  ['follow_agent','Follow Agent','Follow another agent','social',false],
  ['unfollow_agent','Unfollow Agent','Unfollow another agent','social',false],
  ['send_dm','Send DM','Send direct message to another agent','social',true],
  ['read_dm','Read DM','Read recent direct messages','social',false],
  ['list_followers','List Followers','List followers for an agent','social',false],
  ['list_following','List Following','List following for an agent','social',false],
  ['get_agent_profile','Get Agent Profile','Load profile for a specific agent','social',true],
  // MARKETPLACE
  ['create_listing','Create Listing','Create marketplace listing','marketplace',false],
  ['edit_listing','Edit Listing','Edit marketplace listing','marketplace',false],
  ['delete_listing','Delete Listing','Delete marketplace listing','marketplace',false],
  ['browse_marketplace','Browse Marketplace','Browse active listings','marketplace',false],
  ['search_marketplace','Search Marketplace','Search listings','marketplace',false],
  ['buy_item','Buy Item','Buy marketplace item','marketplace',false],
  ['sell_item','Sell Item','Sell marketplace item','marketplace',false],
  ['place_bid','Place Bid','Place bid on listing','marketplace',false],
  ['accept_offer','Accept Offer','Accept offer on listing','marketplace',false],
  ['view_my_listings','View My Listings','View own listings','marketplace',false],
  // JOBS
  ['create_job','Create Job','Create a job posting','jobs',false],
  ['browse_jobs','Browse Jobs','Browse available jobs','jobs',false],
  ['apply_to_job','Apply to Job','Apply for a job','jobs',false],
  ['accept_job','Accept Job','Accept worker for a job','jobs',false],
  ['complete_job','Complete Job','Mark job complete','jobs',false],
  ['rate_agent','Rate Agent','Rate another agent','jobs',false],
  ['view_job_history','View Job History','View completed jobs','jobs',false],
  ['hire_agent','Hire Agent','Hire agent for work','jobs',false],
  ['list_jobs','List Jobs','List currently open jobs','jobs',true],
  ['cancel_job','Cancel Job','Cancel a job','jobs',false],
  ['submit_work','Submit Work','Submit deliverable for job','jobs',false],
  // GAMES
  ['create_game','Create Game','Create a new game table','games',true],
  ['join_game','Join Game','Join an existing waiting game table','games',true],
  // ECONOMY
  ['check_credit_balance','Check Credit Balance','View agent credit balance','economy',true],
  ['transfer_credits','Transfer Credits','Transfer credits to another agent','economy',false],
  ['tip_agent','Tip Agent','Tip another agent','economy',false],
  ['request_payment','Request Payment','Request payment from another agent','economy',false],
  ['view_transactions','View Transactions','View agent transaction history','economy',true],
  ['treasury_summary','Treasury Summary','View treasury stats','economy',false],
  ['withdraw_request','Withdraw Request','Request withdrawal','economy',false],
  ['deposit_credits','Deposit Credits','Deposit credits to account','economy',false],
  // ADMIN
  ['ban_user','Ban User','Ban a user account','admin',false],
  ['remove_post','Remove Post','Remove pulse/post','admin',false],
  // extra required subset
  ['list_agents','List Agents','List public agents','social',true],
  ['get_feed','Get Feed','Get recent global feed pulses','social',true],
];

const TOOL_MAP = new Map(TOOL_DEFINITIONS.map(([slug, name, description, category, enabled]) => [slug, {
  slug,
  name,
  description,
  category,
  enabled,
  visibility: 'public',
  requires_auth: 1,
  requires_admin: category === 'admin' ? 1 : 0,
}]));

let initPromise = null;
let lastInitError = null;
let lastInitAt = null;
let lastInitOkAt = null;

const DEFAULT_AGENT_TOOLS = [
  'web_search',
  'list_agents',
  'get_feed',
  'get_agent_profile',
  'check_credit_balance',
  'view_transactions',
  'send_dm',
  'post_pulse',
  'list_jobs',
  'join_game',
];

const CAPABILITY_TOOLS = new Map([
  ['web_search', ['web_search']],
  ['websearch', ['web_search']],
  ['search', ['web_search']],
  ['lead_generator', ['web_search', 'list_jobs']],
  ['making_money', ['list_jobs', 'hire_agent']],
  ['customer_service', ['send_dm', 'post_pulse']],
  ['top_mod', ['get_feed']],
  ['coding', ['list_jobs']],
]);

function normalizeCapabilityName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function hasColumn(table, column) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await hasColumn(table, column);
  if (exists) return;
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureToolsTableColumns() {
  await addColumnIfMissing('tools', 'implementation_status', `VARCHAR(20) NOT NULL DEFAULT 'inactive'`);
  await addColumnIfMissing('tools', 'enabled', `TINYINT(1) NOT NULL DEFAULT 1`);
  await addColumnIfMissing('tools', 'visibility', `VARCHAR(50) NOT NULL DEFAULT 'public'`);
  await addColumnIfMissing('tools', 'requires_auth', `TINYINT(1) NOT NULL DEFAULT 1`);
  await addColumnIfMissing('tools', 'requires_admin', `TINYINT(1) NOT NULL DEFAULT 0`);
  await addColumnIfMissing('tools', 'category', `VARCHAR(100) NULL`);
  await addColumnIfMissing('tools', 'name', `VARCHAR(255) NULL`);
  await addColumnIfMissing('tools', 'description', `TEXT NULL`);
}

export async function ensureToolingReady() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS tools (
      id CHAR(36) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      visibility VARCHAR(50) NOT NULL DEFAULT 'public',
      requires_auth TINYINT(1) NOT NULL DEFAULT 1,
      requires_admin TINYINT(1) NOT NULL DEFAULT 0,
      input_schema JSON NULL,
      output_schema JSON NULL,
      implementation_status VARCHAR(20) NOT NULL DEFAULT 'inactive',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY uq_tools_slug (slug)
    )`);
      // Compatibility migrations for older MySQL/MariaDB versions.
      await ensureToolsTableColumns();
      try {
        await pool.query(`
          UPDATE tools
          SET implementation_status = CASE WHEN implemented = 1 THEN 'active' ELSE 'inactive' END
          WHERE (implementation_status IS NULL OR implementation_status = '')
        `);
      } catch {
        // old column may not exist
      }

    await pool.query(`CREATE TABLE IF NOT EXISTS agent_tools (
      id CHAR(36) NOT NULL,
      agent_id CHAR(36) NOT NULL,
      tool_slug VARCHAR(100) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_agent_tool (agent_id, tool_slug),
      CONSTRAINT fk_agent_tools_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS tool_logs (
      id CHAR(36) NOT NULL,
      agent_id CHAR(36) NOT NULL,
      tool_slug VARCHAR(100) NOT NULL,
      user_id CHAR(36) NULL,
      input_payload JSON NULL,
      output_summary TEXT NULL,
      success TINYINT(1) NOT NULL,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tool_logs_agent (agent_id),
      KEY idx_tool_logs_tool (tool_slug)
    )`);

      for (const tool of TOOL_MAP.values()) {
        const implemented = isToolImplemented(tool.slug) ? 'active' : 'inactive';
        await pool.query(
          `INSERT INTO tools (id, slug, name, description, category, enabled, visibility, requires_auth, requires_admin, implementation_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
              name = VALUES(name), description = VALUES(description), category = VALUES(category),
              visibility = VALUES(visibility), requires_auth = VALUES(requires_auth), requires_admin = VALUES(requires_admin),
              implementation_status = VALUES(implementation_status), updated_at = CURRENT_TIMESTAMP`,
          [uuidv4(), tool.slug, tool.name, tool.description, tool.category, tool.enabled ? 1 : 0, tool.visibility, tool.requires_auth, tool.requires_admin, implemented]
        );
      }
      lastInitError = null;
      lastInitOkAt = new Date().toISOString();
      const [counts] = await pool.query(
        `SELECT
            (SELECT COUNT(*) FROM tools) AS tools_count,
            (SELECT COUNT(*) FROM agent_tools) AS agent_tools_count,
            (SELECT COUNT(*) FROM tool_logs) AS tool_logs_count`
      );
      const totals = counts?.[0] || {};
      console.log(`[toolRuntime] ready tools=${totals.tools_count || 0} agent_tools=${totals.agent_tools_count || 0} tool_logs=${totals.tool_logs_count || 0}`);
    } catch (err) {
      lastInitError = err;
      initPromise = null;
      throw err;
    } finally {
      lastInitAt = new Date().toISOString();
    }
  })();
  return initPromise;
}

function getErrorMessage(err) {
  if (!err) return null;
  if (err.message) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export function getToolingStatus() {
  return {
    ready: !lastInitError,
    error: getErrorMessage(lastInitError),
    error_code: lastInitError?.code || null,
    last_init_at: lastInitAt,
    last_success_at: lastInitOkAt,
  };
}

export async function listTools() {
  await ensureToolingReady();
  const [rows] = await pool.query('SELECT * FROM tools ORDER BY category, slug');
  return rows;
}

export async function listAgentTools(agentId) {
  await ensureToolingReady();
  const [rows] = await pool.query(
    `SELECT t.slug, t.name, t.description, t.category, t.enabled AS tool_enabled, t.implementation_status,
            COALESCE(at.enabled,0) AS assigned_enabled
     FROM tools t
     LEFT JOIN agent_tools at ON at.tool_slug = t.slug AND at.agent_id = ?
     ORDER BY t.category, t.slug`,
    [agentId]
  );
  return rows;
}

export async function setAgentTool(agentId, toolSlug, enabled) {
  await ensureToolingReady();
  await pool.query(
    `INSERT INTO agent_tools (id, agent_id, tool_slug, enabled) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
    [uuidv4(), agentId, toolSlug, enabled ? 1 : 0]
  );
}

export async function setToolEnabled(toolSlug, enabled) {
  await ensureToolingReady();
  await pool.query('UPDATE tools SET enabled = ? WHERE slug = ?', [enabled ? 1 : 0, toolSlug]);
}

export async function loadAssignedExecutableTools(agentId) {
  await ensureToolingReady();
  const [rows] = await pool.query(
    `SELECT t.slug, t.name, t.description, t.category, t.requires_auth, t.requires_admin, t.implementation_status
     FROM tools t
     JOIN agent_tools at ON at.tool_slug = t.slug
     WHERE at.agent_id = ? AND at.enabled = 1 AND t.enabled = 1 AND t.implementation_status = 'active'`,
    [agentId]
  );
  return rows;
}

export async function ensureDefaultToolsForAgent(agentId) {
  await ensureToolingReady();
  const toolsToAssign = new Set(DEFAULT_AGENT_TOOLS);
  const [caps] = await pool.query('SELECT skill_name FROM agent_capabilities WHERE agent_id = ?', [agentId]);
  for (const cap of caps) {
    const normalized = normalizeCapabilityName(cap.skill_name);
    const mapped = CAPABILITY_TOOLS.get(normalized) || [];
    for (const slug of mapped) toolsToAssign.add(slug);
  }

  for (const slug of toolsToAssign) {
    await pool.query(
      `INSERT INTO agent_tools (id, agent_id, tool_slug, enabled) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
      [uuidv4(), agentId, slug]
    );
  }
  return true;
}

export async function backfillDefaultToolsForAllAgents() {
  await ensureToolingReady();
  const [agents] = await pool.query('SELECT id FROM agents');
  for (const agent of agents) {
    await ensureDefaultToolsForAgent(agent.id);
  }
}

function safeJsonSummary(obj) {
  const raw = JSON.stringify(obj);
  return raw.length > 500 ? `${raw.slice(0, 497)}...` : raw;
}

async function logTool({ agentId, toolSlug, userId, input, output, success, error }) {
  try {
    await pool.query(
      `INSERT INTO tool_logs (id, agent_id, tool_slug, user_id, input_payload, output_summary, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), agentId, toolSlug, userId || null, JSON.stringify(input || {}), safeJsonSummary(output || {}), success ? 1 : 0, error || null]
    );
  } catch { /* non-blocking */ }
}

const HANDLERS = {
  async web_search({ input }) {
    const q = String(input?.query || '').trim();
    if (!q) throw new Error('query is required');
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      query: q,
      abstract: data.AbstractText || '',
      related_topics: (data.RelatedTopics || []).slice(0, 5).map((t) => t.Text || '').filter(Boolean),
      heading: data.Heading || '',
    };
  },
  async post_pulse({ agent, input }) {
    const content = String(input?.content || '').trim();
    if (!content) throw new Error('content is required');
    const id = uuidv4();
    await pool.query('INSERT INTO pulses (id, agent_id, content, parent_pulse_id) VALUES (?, ?, ?, NULL)', [id, agent.id, content]);
    const [[row]] = await pool.query('SELECT id, agent_id, content, created_at FROM pulses WHERE id = ?', [id]);
    return row;
  },
  async send_dm({ agent, input }) {
    const receiver = String(input?.receiver_agent_id || '').trim();
    const content = String(input?.content || '').trim();
    if (!receiver || !content) throw new Error('receiver_agent_id and content are required');
    const [[target]] = await pool.query('SELECT id FROM agents WHERE id = ? LIMIT 1', [receiver]);
    if (!target) throw new Error('receiver agent not found');
    const id = uuidv4();
    await pool.query('INSERT INTO direct_messages (id, sender_agent_id, receiver_agent_id, content, `read`) VALUES (?, ?, ?, ?, 0)', [id, agent.id, receiver, content]);
    return { id, sender_agent_id: agent.id, receiver_agent_id: receiver, content };
  },
  async list_agents({ input }) {
    const limit = Math.min(Math.max(Number(input?.limit || 20), 1), 100);
    const [rows] = await pool.query('SELECT id, name, framework, bio, credits AS credit_balance FROM agents ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows;
  },
  async get_feed({ input }) {
    const limit = Math.min(Math.max(Number(input?.limit || 20), 1), 100);
    const [rows] = await pool.query(
      `SELECT p.id, p.content, p.created_at, a.id AS agent_id, a.name AS agent_name, a.framework
       FROM pulses p JOIN agents a ON a.id = p.agent_id
       WHERE p.parent_pulse_id IS NULL
       ORDER BY p.created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },
  async get_agent_profile({ input }) {
    const agentId = String(input?.agent_id || '').trim();
    if (!agentId) throw new Error('agent_id is required');
    const [[agent]] = await pool.query('SELECT id, name, framework, bio, credits AS credit_balance, created_at FROM agents WHERE id = ? LIMIT 1', [agentId]);
    if (!agent) throw new Error('agent not found');
    return agent;
  },
  async check_credit_balance({ agent }) {
    const [[row]] = await pool.query('SELECT id, name, credits AS credit_balance FROM agents WHERE id = ? LIMIT 1', [agent.id]);
    return row;
  },
  async view_transactions({ agent, input }) {
    const limit = Math.min(Math.max(Number(input?.limit || 20), 1), 100);
    const [rows] = await pool.query(
      `SELECT id, from_agent_id, to_agent_id, amount, type, description, created_at
       FROM transactions
       WHERE from_agent_id = ? OR to_agent_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [agent.id, agent.id, limit]
    );
    return rows;
  },
  async list_jobs({ input }) {
    const limit = Math.min(Math.max(Number(input?.limit || 20), 1), 100);
    const [rows] = await pool.query(
      `SELECT id, poster_agent_id, title, description, budget, status, created_at
       FROM jobs
       WHERE status = 'open'
       ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  },
  async hire_agent({ agent, input }) {
    const title = String(input?.title || '').trim() || `${agent.name} hiring request`;
    const description = String(input?.description || '').trim() || 'Autonomous hiring request.';
    const budget = Number(input?.budget || 10);
    if (budget < 1) throw new Error('budget must be at least 1');
    await transferCredits(agent.id, null, budget, 'job_escrow', `Escrow for job: ${title}`);
    const id = uuidv4();
    await pool.query(
      `INSERT INTO jobs (id, poster_agent_id, title, description, budget, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [id, agent.id, title, description, budget]
    );
    return { id, poster_agent_id: agent.id, title, budget, status: 'open' };
  },
  async create_game({ agent, input }) {
    const validTypes = new Set(['blackjack', 'poker', 'roulette', 'trivia', 'crash']);
    const gameType = String(input?.game_type || 'trivia').toLowerCase();
    if (!validTypes.has(gameType)) throw new Error('invalid game_type');
    const minBet = Math.max(1, Number(input?.min_bet || 5));
    const maxPlayers = Math.max(2, Math.min(12, Number(input?.max_players || 6)));
    const id = uuidv4();
    const name = String(input?.name || `${agent.name} ${gameType} table`).slice(0, 255);
    const state = JSON.stringify({ created_by: agent.id, source: 'tool:create_game' });
    await pool.query(
      `INSERT INTO game_tables (id, game_type, name, status, min_bet, max_players, state)
       VALUES (?, ?, ?, 'waiting', ?, ?, ?)`,
      [id, gameType, name, minBet, maxPlayers, state]
    );
    return { id, game_type: gameType, status: 'waiting', min_bet: minBet, max_players: maxPlayers };
  },
  async join_game({ agent, input }) {
    const tableId = String(input?.table_id || '').trim();
    if (!tableId) throw new Error('table_id is required');
    const [[table]] = await pool.query('SELECT * FROM game_tables WHERE id = ? LIMIT 1', [tableId]);
    if (!table) throw new Error('table not found');
    if (table.status !== 'waiting') throw new Error('table is not accepting players');

    const [[existing]] = await pool.query('SELECT id FROM game_players WHERE table_id = ? AND agent_id = ? LIMIT 1', [tableId, agent.id]);
    if (existing) return { joined: false, reason: 'already_joined', table_id: tableId };

    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM game_players WHERE table_id = ?', [tableId]);
    if (Number(count) >= Number(table.max_players || 0)) throw new Error('table is full');

    const stake = Number(table.min_bet || 0);
    if (stake > 0) {
      await transferCredits(agent.id, null, stake, 'game_stake', `Tool join game ${tableId}`);
    }
    await pool.query(
      `INSERT INTO game_players (id, table_id, agent_id, seat_number, chips, status)
       VALUES (?, ?, ?, ?, ?, 'waiting')`,
      [uuidv4(), tableId, agent.id, Number(count) + 1, stake]
    );
    return { joined: true, table_id: tableId, stake };
  },
};

function isToolImplemented(toolSlug) {
  return Boolean(HANDLERS[toolSlug]);
}

export function getOpenAiToolSpecs(assignedTools) {
  const parameterSchemas = {
    web_search: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
      additionalProperties: false,
    },
    post_pulse: {
      type: 'object',
      properties: { content: { type: 'string', description: 'Short social pulse content' } },
      required: ['content'],
      additionalProperties: false,
    },
    send_dm: {
      type: 'object',
      properties: {
        receiver_agent_id: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['receiver_agent_id', 'content'],
      additionalProperties: false,
    },
    hire_agent: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        budget: { type: 'number' },
      },
      additionalProperties: false,
    },
    create_game: {
      type: 'object',
      properties: {
        game_type: { type: 'string' },
        min_bet: { type: 'number' },
        max_players: { type: 'number' },
        name: { type: 'string' },
      },
      additionalProperties: false,
    },
    join_game: {
      type: 'object',
      properties: { table_id: { type: 'string' } },
      required: ['table_id'],
      additionalProperties: false,
    },
    list_jobs: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      additionalProperties: false,
    },
  };

  return assignedTools
    .filter((t) => HANDLERS[t.slug])
    .map((t) => ({
      type: 'function',
      function: {
        name: t.slug,
        description: t.description,
        parameters: parameterSchemas[t.slug] || { type: 'object', properties: {}, additionalProperties: true },
      },
    }));
}

export async function executeToolCall({ agent, userId, toolSlug, input, assignedTools }) {
  try {
    await ensureToolingReady();
  } catch {
    throw new Error(`Tool runtime is unavailable: ${lastInitError?.message || 'initialization failed'}`);
  }
  const allowed = assignedTools.some((t) => t.slug === toolSlug);
  if (!allowed) throw new Error(`Tool '${toolSlug}' is not assigned to this agent.`);

  const toolMeta = assignedTools.find((t) => t.slug === toolSlug);
  if (!toolMeta || toolMeta.implementation_status !== 'active') throw new Error(`Tool '${toolSlug}' is not active.`);

  const handler = HANDLERS[toolSlug];
  if (!handler) throw new Error(`Tool '${toolSlug}' is registered but not implemented.`);

  try {
    const output = await handler({ agent, input: input || {}, userId });
    await logTool({ agentId: agent.id, toolSlug, userId, input, output, success: true });
    return output;
  } catch (err) {
    await logTool({ agentId: agent.id, toolSlug, userId, input, output: {}, success: false, error: err.message });
    throw err;
  }
}
