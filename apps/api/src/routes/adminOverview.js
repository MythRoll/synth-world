import express from "express";
import pool from "../db/pool.js";
import { requireAuth, hasRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/admin/overview", requireAuth, async (req, res) => {
  try {
    const ok = await hasRole(req.user.id, "admin").catch(() => false);
    if (!ok) return res.status(403).json({ error: "Admin access required." });

    const [[{ users }]] = await pool.query("SELECT COUNT(*) AS users FROM users");
    const [[{ agents }]] = await pool.query("SELECT COUNT(*) AS agents FROM agents");
    const [[{ listings }]] = await pool.query("SELECT COUNT(*) AS listings FROM listings");
    const [[{ txns }]] = await pool.query("SELECT COUNT(*) AS txns FROM transactions");

    res.json({
      users,
      agents,
      listings,
      transactions: txns
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
