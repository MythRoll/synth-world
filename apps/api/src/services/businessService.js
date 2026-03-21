import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { transferCredits, assertOwnership } from './creditService.js';

export async function handleBusinessAction(params, userId) {
  const { action } = params;
  switch (action) {
    case 'create_business':     return createBusiness(params, userId);
    case 'add_member':          return addMember(params, userId);
    case 'remove_member':       return removeMember(params, userId);
    case 'distribute_revenue':  return distributeRevenue(params, userId);
    case 'update_business':     return updateBusiness(params, userId);
    default:
      throw Object.assign(new Error(`Unknown business action: ${action}`), { status: 400 });
  }
}

// ─── create_business ──────────────────────────────────────────────────────────
async function createBusiness({ agent_id, name, description, business_type }, userId) {
  if (!agent_id || !name) throw Object.assign(new Error('agent_id and name required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const id = uuidv4();
  await pool.query(
    `INSERT INTO businesses (id, owner_agent_id, name, description, type, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [id, agent_id, name, description || '', business_type || 'general']
  );

  // Auto-add owner as a member
  await pool.query(
    `INSERT INTO business_members (id, business_id, agent_id, role, revenue_share_percent)
     VALUES (?, ?, ?, 'owner', 100)`,
    [uuidv4(), id, agent_id]
  );

  const [[biz]] = await pool.query('SELECT * FROM businesses WHERE id = ?', [id]);
  return { data: biz };
}

// ─── add_member ───────────────────────────────────────────────────────────────
async function addMember({ agent_id, business_id, member_agent_id, revenue_share_percent, role }, userId) {
  if (!agent_id || !business_id || !member_agent_id) {
    throw Object.assign(new Error('agent_id, business_id and member_agent_id required.'), { status: 400 });
  }
  await assertOwnership(agent_id, userId);

  const [[biz]] = await pool.query('SELECT * FROM businesses WHERE id = ?', [business_id]);
  if (!biz) throw Object.assign(new Error('Business not found.'), { status: 404 });
  if (biz.owner_agent_id !== agent_id) throw Object.assign(new Error('Only the owner can add members.'), { status: 403 });

  // Validate total share won't exceed 100
  const [[{ total_share }]] = await pool.query(
    'SELECT COALESCE(SUM(revenue_share_percent), 0) AS total_share FROM business_members WHERE business_id = ?',
    [business_id]
  );
  const share = Number(revenue_share_percent || 0);
  if (Number(total_share) + share > 100) {
    throw Object.assign(
      new Error(`Total revenue share would exceed 100% (currently at ${total_share}%).`),
      { status: 400 }
    );
  }

  // If adding member with share, reduce owner's share accordingly
  if (share > 0) {
    const [[ownerMember]] = await pool.query(
      `SELECT id, revenue_share_percent FROM business_members WHERE business_id = ? AND role = 'owner' LIMIT 1`,
      [business_id]
    );
    if (ownerMember) {
      const newOwnerShare = Math.max(0, Number(ownerMember.revenue_share_percent) - share);
      await pool.query(
        'UPDATE business_members SET revenue_share_percent = ? WHERE id = ?',
        [newOwnerShare, ownerMember.id]
      );
    }
  }

  const memberId = uuidv4();
  await pool.query(
    `INSERT INTO business_members (id, business_id, agent_id, role, revenue_share_percent)
     VALUES (?, ?, ?, ?, ?)`,
    [memberId, business_id, member_agent_id, role || 'member', share]
  );

  const [[member]] = await pool.query('SELECT * FROM business_members WHERE id = ?', [memberId]);
  return { data: member };
}

// ─── remove_member ────────────────────────────────────────────────────────────
async function removeMember({ agent_id, business_id, member_agent_id }, userId) {
  if (!agent_id || !business_id || !member_agent_id) {
    throw Object.assign(new Error('agent_id, business_id and member_agent_id required.'), { status: 400 });
  }
  await assertOwnership(agent_id, userId);

  const [[biz]] = await pool.query('SELECT * FROM businesses WHERE id = ?', [business_id]);
  if (!biz) throw Object.assign(new Error('Business not found.'), { status: 404 });
  if (biz.owner_agent_id !== agent_id) throw Object.assign(new Error('Only the owner can remove members.'), { status: 403 });
  if (member_agent_id === agent_id) throw Object.assign(new Error('Owner cannot remove themselves.'), { status: 400 });

  const [[member]] = await pool.query(
    'SELECT * FROM business_members WHERE business_id = ? AND agent_id = ?',
    [business_id, member_agent_id]
  );
  if (!member) throw Object.assign(new Error('Member not found.'), { status: 404 });

  // Return their share to owner
  if (Number(member.revenue_share_percent) > 0) {
    await pool.query(
      `UPDATE business_members SET revenue_share_percent = revenue_share_percent + ?
       WHERE business_id = ? AND role = 'owner'`,
      [member.revenue_share_percent, business_id]
    );
  }

  await pool.query(
    'DELETE FROM business_members WHERE business_id = ? AND agent_id = ?',
    [business_id, member_agent_id]
  );
  return { data: { removed: member_agent_id } };
}

// ─── distribute_revenue ───────────────────────────────────────────────────────
// Distribute a credit amount from the business owner to all members per their share %
async function distributeRevenue({ agent_id, business_id, total_credits }, userId) {
  if (!agent_id || !business_id || !total_credits) {
    throw Object.assign(new Error('agent_id, business_id and total_credits required.'), { status: 400 });
  }
  await assertOwnership(agent_id, userId);

  const [[biz]] = await pool.query('SELECT * FROM businesses WHERE id = ?', [business_id]);
  if (!biz) throw Object.assign(new Error('Business not found.'), { status: 404 });
  if (biz.owner_agent_id !== agent_id) throw Object.assign(new Error('Only the owner can distribute revenue.'), { status: 403 });

  const [members] = await pool.query(
    'SELECT * FROM business_members WHERE business_id = ? AND revenue_share_percent > 0',
    [business_id]
  );
  if (!members.length) throw Object.assign(new Error('No members with a revenue share.'), { status: 400 });

  const total = Number(total_credits);
  const distributions = [];

  for (const member of members) {
    const share = Number(member.revenue_share_percent) / 100;
    const amount = parseFloat((total * share).toFixed(4));
    if (amount <= 0) continue;

    if (member.agent_id !== agent_id) {
      await transferCredits(agent_id, member.agent_id, amount, 'revenue_share',
        `Revenue share from business: ${biz.name}`);
    }
    distributions.push({ agent_id: member.agent_id, amount, share: member.revenue_share_percent });
  }

  // Record total revenue on business
  await pool.query(
    'UPDATE businesses SET revenue = revenue + ? WHERE id = ?',
    [total, business_id]
  );

  return { data: { business_id, total_distributed: total, distributions } };
}

// ─── update_business ──────────────────────────────────────────────────────────
async function updateBusiness({ agent_id, business_id, name, description, status }, userId) {
  if (!agent_id || !business_id) throw Object.assign(new Error('agent_id and business_id required.'), { status: 400 });
  await assertOwnership(agent_id, userId);

  const [[biz]] = await pool.query('SELECT * FROM businesses WHERE id = ?', [business_id]);
  if (!biz) throw Object.assign(new Error('Business not found.'), { status: 404 });
  if (biz.owner_agent_id !== agent_id) throw Object.assign(new Error('Only the owner can update this business.'), { status: 403 });

  const updates = {};
  if (name)        updates.name = name;
  if (description) updates.description = description;
  if (status && ['active', 'inactive'].includes(status)) updates.status = status;

  if (Object.keys(updates).length) {
    const fields = Object.keys(updates).map(f => `\`${f}\` = ?`).join(', ');
    await pool.query(
      `UPDATE businesses SET ${fields} WHERE id = ?`,
      [...Object.values(updates), business_id]
    );
  }

  const [[updated]] = await pool.query('SELECT * FROM businesses WHERE id = ?', [business_id]);
  return { data: updated };
}
