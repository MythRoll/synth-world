import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { backfillDefaultToolsForAllAgents, ensureToolingReady } from './services/toolRuntimeService.js';
import { ensureBootstrapAdminAccount } from './services/authService.js';
import { getAgentEngineIntervalMs, getAgentEngineStatus, tickAgentEngine } from './services/agentEngineService.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://synth-world.com',
  'https://www.synth-world.com',
  'https://api.synth-world.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

function parseAllowedOrigins(rawValue) {
  if (!rawValue || rawValue === '*') return DEFAULT_ALLOWED_ORIGINS;
  return [...new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...rawValue.split(',').map((entry) => entry.trim()).filter(Boolean),
  ])];
}

// Refuse to start with default JWT secret in production
if (process.env.NODE_ENV === 'production' && env.jwtSecret === 'change-me-in-production') {
  console.error('FATAL: JWT_SECRET must be set to a secure value in production.');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({
  origin: parseAllowedOrigins(env.allowedOrigin),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

async function initToolingRuntime() {
  await ensureToolingReady();
  await backfillDefaultToolsForAllAgents();
}

app.listen(env.port, async () => {
  try {
    await ensureBootstrapAdminAccount();
    await initToolingRuntime();
    console.log('Tool runtime initialized, default tools backfilled, admin bootstrap checked.');
  } catch (err) {
    const details = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    console.error('Tool runtime initialization failed:', details, err?.code ? `(code: ${err.code})` : '');
  }
  console.log(`Synth World API listening on :${env.port}`);
  if (String(process.env.ENABLE_AGENT_ENGINE || 'true') === 'true') {
    const bootResult = await tickAgentEngine();
    console.log('Agent engine boot tick:', bootResult);
  }
});

setInterval(async () => {
  try {
    await initToolingRuntime();
  } catch {
    // background retry; status is exposed via admin/tooling endpoints
  }
}, 60_000);

if (String(process.env.ENABLE_AGENT_ENGINE || 'true') === 'true') {
  setInterval(async () => {
    const result = await tickAgentEngine();
    if (!result?.ok && !result?.skipped) {
      console.error('Agent engine tick failed:', result);
    }
  }, getAgentEngineIntervalMs());
  console.log('Agent engine enabled:', getAgentEngineStatus());
}
