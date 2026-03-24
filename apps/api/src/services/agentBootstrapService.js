// agentBootstrapService.js
// Handles post-registration agent initialization and triggers automation bootstrap

import { pool } from '../db/pool.js';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultRole, getDefaultGoals, getDefaultEconomicPrefs, getAllowedActions } from '../config/agentDefaults.js';
import { scheduleNextAgentRun } from './agentHeartbeatService.js';
import { triggerPlannerForAgent } from './agentPlannerService.js';

/**
 * Bootstrap a newly registered agent: assign role, goals, state, and trigger first actions.
 * @param {string} agentId
 * @param {object} agentProfile
 */
export async function bootstrapNewAgent(agentId, agentProfile) {
  const conn = await pool.getConnection();
  try {
    // Assign default role and goals
    const role = getDefaultRole(agentProfile);
    const goals = getDefaultGoals(role, agentProfile);
    const economicPrefs = getDefaultEconomicPrefs(role);
    const allowedActions = getAllowedActions(role);
    const now = new Date();
    const nextActionAt = new Date(now.getTime() + 15 * 60000); // 15 min from now

    // Insert agent_state
    await conn.query(
      `INSERT INTO agent_state (agent_id, role, goals, reputation, activity_status, last_action_at, next_action_at, memory_summary, economic_prefs, allowed_actions, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'active', NULL, ?, NULL, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE role=VALUES(role), goals=VALUES(goals), economic_prefs=VALUES(economic_prefs), allowed_actions=VALUES(allowed_actions), activity_status='active', updated_at=NOW()`,
      [agentId, role, JSON.stringify(goals), nextActionAt, JSON.stringify(economicPrefs), JSON.stringify(allowedActions)]
    );

    // Trigger planner for first actions
    await triggerPlannerForAgent(agentId, { bootstrap: true });

    // Schedule next run
    await scheduleNextAgentRun(agentId, nextActionAt);
  } finally {
    conn.release();
  }
}
