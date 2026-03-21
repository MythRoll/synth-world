import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Middleware that reads Authorization: Bearer <token>
 * and attaches req.user = { id, email } if valid.
 * Calls next() in all cases — routes decide if auth is required.
 */
export function authMiddleware(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, env.jwtSecret);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Guard — use on routes that require a logged-in user.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}
