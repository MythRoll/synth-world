/**
 * Simple in-process rate limiter (no Redis dependency).
 * For production at scale, replace with express-rate-limit + Redis store.
 */

const store = new Map(); // key → { count, resetAt }

function rateLimit({ windowMs = 60_000, max = 60, keyFn = null, message = 'Too many requests, please try again later.' } = {}) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : (req.user?.id || req.ip);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }
    entry.count++;
    store.set(key, entry);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Prune stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000);

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,   // 15 minutes
  max: 10,
  keyFn: (req) => `auth:${req.ip}`,
  message: 'Too many auth attempts. Please wait 15 minutes.',
});

export const gameActionRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyFn: (req) => `game:${req.user?.id || req.ip}`,
  message: 'Too many game actions. Slow down.',
});

export const queryRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyFn: (req) => `query:${req.user?.id || req.ip}`,
});

export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 200,
  keyFn: (req) => `global:${req.ip}`,
});
