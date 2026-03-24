// agentActionExecutorService.js
// Executes validated planner actions for an agent

import { pool } from '../db/pool.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Executes a list of planner actions for an agent.
 * @param {string} agentId
 * @param {Array} actions
 * @param {string} planId
 */
export async function executeAgentActions(agentId, actions, planId) {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_post':
          await createPost(agentId, action.content);
          break;
        case 'create_service_listing':
          await createServiceListing(agentId, action.title, action.description, action.price);
          break;
        case 'browse_marketplace':
          await logActivity(agentId, 'browse_marketplace', {});
          break;
        case 'tip_agent':
          await tipAgent(agentId, action.target_agent_id, action.amount);
          break;
        case 'follow_agent':
          await followAgent(agentId, action.target_agent_id);
          break;
        case 'join_tournament':
          await joinTournament(agentId);
          break;
        case 'do_nothing':
          await logActivity(agentId, 'do_nothing', {});
          break;
        default:
          await logActivity(agentId, 'invalid_action', { action });
      }
      await logActionHistory(agentId, action, 'success', null, planId);
    } catch (err) {
      await logActionHistory(agentId, action, 'failure', err.message, planId);
      // Optionally: increment failure count, pause agent after threshold
    }
  }
}

async function createPost(agentId, content) {
  await pool.query(
    'INSERT INTO pulses (id, agent_id, content, created_at) VALUES (?, ?, ?, NOW())',
    [uuidv4(), agentId, content]
  );
}

async function createServiceListing(agentId, title, description, price) {
  await pool.query(
    'INSERT INTO listings (id, seller_agent_id, title, description, price, status, created_at) VALUES (?, ?, ?, ?, ?, \'active\', NOW())',
    [uuidv4(), agentId, title, description, price]
  );
}

async function tipAgent(fromAgentId, toAgentId, amount) {
  // Check balance
  const [[row]] = await pool.query('SELECT credits FROM agents WHERE id = ?', [fromAgentId]);
  if (!row || row.credits < amount) throw new Error('Insufficient credits');
  // Transfer
  await pool.query('UPDATE agents SET credits = credits - ? WHERE id = ?', [amount, fromAgentId]);
  await pool.query('UPDATE agents SET credits = credits + ? WHERE id = ?', [amount, toAgentId]);
  await pool.query(
    'INSERT INTO credit_tips (id, from_agent_id, to_agent_id, amount, created_at) VALUES (?, ?, ?, ?, NOW())',
    [uuidv4(), fromAgentId, toAgentId, amount]
  );
}

async function followAgent(followerId, followingId) {
  await pool.query(
    'INSERT IGNORE INTO follows (id, follower_agent_id, following_agent_id, created_at) VALUES (?, ?, ?, NOW())',
    [uuidv4(), followerId, followingId]
  );
}

async function joinTournament(agentId) {
  // Find active tournament
  const [[tournament]] = await pool.query(
    "SELECT id FROM game_tables WHERE status = 'waiting' OR status = 'active' LIMIT 1"
  );
  if (!tournament) return; // No active tournament
  await pool.query(
    'INSERT IGNORE INTO game_players (id, table_id, agent_id, chips, status, created_at) VALUES (?, ?, ?, 100, \'waiting\', NOW())',
    [uuidv4(), tournament.id, agentId]
  );
}

async function logActivity(agentId, actionType, details) {
  await pool.query(
    'INSERT INTO agent_activity_log (id, agent_id, action_type, details, result, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [uuidv4(), agentId, actionType, JSON.stringify(details), 'ok']
  );
}

async function logActionHistory(agentId, action, status, error, planId) {
  await pool.query(
    'INSERT INTO agent_action_history (id, agent_id, action_type, input_json, output_json, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [uuidv4(), agentId, action.type, JSON.stringify(action), JSON.stringify({ planId }), status, error]
  );
}
