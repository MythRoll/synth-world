import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { hasRole } from "../services/authService.js";

const router = Router();

router.get("/admin/overview", requireAuth, async (req, res) => {
  try {
    const ok = await hasRole(req.user.id, "admin").catch(() => false);
    if (!ok) return res.status(403).json({ error: "Admin access required." });


    const [[{ users }]] = await pool.query("SELECT COUNT(*) AS users FROM users");
    const [[{ agents }]] = await pool.query("SELECT COUNT(*) AS agents FROM agents");
    const [[{ listings }]] = await pool.query("SELECT COUNT(*) AS listings FROM listings");
    const [[{ txns }]] = await pool.query("SELECT COUNT(*) AS txns FROM transactions");
    const [[{ bans }]] = await pool.query("SELECT COUNT(*) AS bans FROM user_bans");

    // Treasury (optional)
    let treasury = null;
    try {
      const [[row]] = await pool.query("SELECT SUM(balance) AS treasury FROM treasury");
      treasury = row ? row.treasury : null;
    } catch {}

    // Credits in circulation (optional)
    let credits_in_circulation = null;
    try {
      const [[row]] = await pool.query("SELECT SUM(credit_balance) AS credits_in_circulation FROM agents");
      credits_in_circulation = row ? row.credits_in_circulation : null;
    } catch {}

    res.json({
      users,
      agents,
      listings,
      transactions: txns,
      bans,
      treasury,
      credits_in_circulation
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent Automation Admin API ─────────────────────────────────────────────
router.get('/admin/automation/agents', requireAuth, async (req, res) => {
  try {
    const ok = await hasRole(req.user.id, 'admin').catch(() => false);
    if (!ok) return res.status(403).json({ error: 'Admin access required.' });
    const [rows] = await pool.query(`
      SELECT a.id as agent_id, a.name, s.role, s.activity_status, a.credits, s.last_action_at, s.next_action_at, s.failure_count
      FROM agents a
      JOIN agent_state s ON a.id = s.agent_id
      ORDER BY s.next_action_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/automation/agent/:agentId/:action', requireAuth, async (req, res) => {
  try {
    const ok = await hasRole(req.user.id, 'admin').catch(() => false);
    if (!ok) return res.status(403).json({ error: 'Admin access required.' });
    const { agentId, action } = req.params;
    if (action === 'pause') {
      await pool.query('UPDATE agent_state SET activity_status = ? WHERE agent_id = ?', ['paused', agentId]);
    } else if (action === 'resume') {
      await pool.query('UPDATE agent_state SET activity_status = ? WHERE agent_id = ?', ['active', agentId]);
    } else if (action === 'run') {
      const { triggerPlannerForAgent } = await import('../services/agentPlannerService.js');
      await triggerPlannerForAgent(agentId, { manual: true });
    } else if (action === 'bootstrap') {
      const { bootstrapNewAgent } = await import('../services/agentBootstrapService.js');
      const [[agent]] = await pool.query('SELECT * FROM agents WHERE id = ?', [agentId]);
      await bootstrapNewAgent(agentId, agent);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
