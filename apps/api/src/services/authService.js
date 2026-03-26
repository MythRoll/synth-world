import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;
const ADMIN_EMAIL = 'admin@synth-world.com';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiry }
  );
}

async function ensureBootstrapAdmin(user) {
  if (!user?.email || user.email.toLowerCase() !== ADMIN_EMAIL) return;
  await pool.query(
    'INSERT IGNORE INTO admins (id, user_id) VALUES (?, ?)',
    [uuidv4(), user.id]
  );
  await pool.query(
    'INSERT IGNORE INTO roles (user_id, role) VALUES (?, ?)',
    [user.id, 'admin']
  );
}

export async function ensureBootstrapAdminAccount() {
  const [rows] = await pool.query(
    'SELECT id, email FROM `users` WHERE email = ? LIMIT 1',
    [ADMIN_EMAIL]
  );
  if (!rows.length) return false;
  await ensureBootstrapAdmin(rows[0]);
  return true;
}

export async function register(email, password) {
  const [existing] = await pool.query(
    'SELECT id FROM `users` WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  if (existing.length) {
    throw Object.assign(new Error('Email already registered.'), { status: 409 });
  }

  const id   = uuidv4();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query(
    'INSERT INTO `users` (`id`, `email`, `password_hash`) VALUES (?, ?, ?)',
    [id, email.toLowerCase(), hash]
  );
  const user  = { id, email: email.toLowerCase() };
  await ensureBootstrapAdmin(user);
  const token = signToken(user);
  return { token, user };
}

export async function login(email, password) {
  const [rows] = await pool.query(
    'SELECT `id`, `email`, `password_hash` FROM `users` WHERE email = ? LIMIT 1',
    [email.toLowerCase()]
  );
  if (!rows.length) {
    throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
  }

  const row = rows[0];
  const ok  = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
  }

  const user  = { id: row.id, email: row.email };
  await ensureBootstrapAdmin(user);
  const token = signToken(user);
  return { token, user };
}

export async function hasRole(userId, role) {
  const [rows] = await pool.query(
    'SELECT 1 FROM `roles` WHERE user_id = ? AND role = ? LIMIT 1',
    [userId, role]
  );
  // Also check admins table for "admin" role
  if (!rows.length && role === 'admin') {
    const [adminRows] = await pool.query(
      'SELECT 1 FROM `admins` WHERE user_id = ? LIMIT 1',
      [userId]
    );
    return adminRows.length > 0;
  }
  return rows.length > 0;
}

export async function getUserRoles(userId) {
  const [rows] = await pool.query('SELECT role FROM roles WHERE user_id = ?', [userId]);
  const roles = new Set(rows.map((r) => r.role));
  const [adminRows] = await pool.query('SELECT 1 FROM admins WHERE user_id = ? LIMIT 1', [userId]);
  if (adminRows.length) roles.add('admin');
  return [...roles];
}
