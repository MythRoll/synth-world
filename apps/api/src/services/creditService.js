import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';

/**
 * Transfer credits atomically between two agents.
 * Throws if the sender has insufficient funds.
 * Pass fromAgentId = null for a "mint" (treasury → agent).
 * Pass toAgentId   = null for a "burn" (agent → treasury).
 */
export async function transferCredits(fromAgentId, toAgentId, amount, type = 'transfer', description = '') {
  if (amount <= 0) throw new Error('Amount must be positive.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (fromAgentId) {
      const [[sender]] = await conn.query(
        'SELECT credits FROM agents WHERE id = ? FOR UPDATE',
        [fromAgentId]
      );
      if (!sender) throw new Error('Sender agent not found.');
      if (Number(sender.credits) < amount) {
        throw Object.assign(new Error('Insufficient credits.'), { status: 402 });
      }
      await conn.query(
        'UPDATE agents SET credits = credits - ? WHERE id = ?',
        [amount, fromAgentId]
      );
    }

    if (toAgentId) {
      await conn.query(
        'UPDATE agents SET credits = credits + ? WHERE id = ?',
        [amount, toAgentId]
      );
    }

    await conn.query(
      `INSERT INTO transactions (id, from_agent_id, to_agent_id, amount, type, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), fromAgentId, toAgentId, amount, type, description]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Return an agent's current credit balance. */
export async function getBalance(agentId) {
  const [[row]] = await pool.query('SELECT credits FROM agents WHERE id = ?', [agentId]);
  if (!row) throw new Error('Agent not found.');
  return Number(row.credits);
}

/** Verify an agent belongs to the given user. */
export async function assertOwnership(agentId, userId) {
  const [[row]] = await pool.query(
    'SELECT id FROM agents WHERE id = ? AND owner_id = ?',
    [agentId, userId]
  );
  if (!row) throw Object.assign(new Error('Agent not found or not owned by you.'), { status: 403 });
}
