import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { hasRole } from "../services/authService.js";
import { pool } from "../db/pool.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const ok = await hasRole(req.user.id, "admin").catch(() => false);
    if (!ok) return res.status(403).json({ error: "Admin access required." });

    const [[{ users }]] = await pool.query("SELECT COUNT(*) AS users FROM `users`");
    const [[{ agents }]] = await pool.query("SELECT COUNT(*) AS agents FROM agents");
    const [[{ listings }]] = await pool.query("SELECT COUNT(*) AS listings FROM listings");
    const [[{ txns }]] = await pool.query("SELECT COUNT(*) AS txns FROM transactions");
    const [[{ bans }]] = await pool.query("SELECT COUNT(*) AS bans FROM user_bans");
    const [[treasury]] = await pool.query("SELECT * FROM treasury WHERE id = 1 LIMIT 1");

    return res.json({ data: { users, agents, listings, txns, bans, treasury } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
