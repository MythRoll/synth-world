import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiry }
  );
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
