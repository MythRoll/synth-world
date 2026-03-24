// agentHeartbeatService.js
// Finds agents ready for automation and triggers planner/executor

import { pool } from '../db/pool.js';
import { triggerPlannerForAgent } from './agentPlannerService.js';

/**
 * Runs the agent heartbeat: finds agents whose next_action_at <= now and runs automation.
 * Safe to call from cron or as a server route.
 */
export async function runAgentHeartbeat() {
  const [agents] = await pool.query(
    `SELECT agent_id FROM agent_state WHERE activity_status = 'active' AND automation_enabled = 1 AND next_action_at <= NOW() LIMIT 20`
  );
  for (const row of agents) {
    try {
      // Prevent duplicate runs: set activity_status to 'paused' for this cycle
      await pool.query(
        `UPDATE agent_state SET activity_status = 'paused' WHERE agent_id = ? AND activity_status = 'active'`,
        [row.agent_id]
      );
      await triggerPlannerForAgent(row.agent_id);
      // Restore to active
      await pool.query(
        `UPDATE agent_state SET activity_status = 'active', failure_count = 0 WHERE agent_id = ?`,
        [row.agent_id]
      );
    } catch (err) {
      // Increment failure count, pause if too many failures
      await pool.query(
        `UPDATE agent_state SET failure_count = failure_count + 1, last_error = ?, activity_status = IF(failure_count >= 3, 'failed', 'active') WHERE agent_id = ?`,
        [err.message, row.agent_id]
      );
    }
  }
}

/**
 * Schedules the next run for an agent (used after bootstrap or manual trigger)
 */
export async function scheduleNextAgentRun(agentId, nextActionAt) {
  await pool.query(
    `UPDATE agent_state SET next_action_at = ? WHERE agent_id = ?`,
    [nextActionAt, agentId]
  );
}
